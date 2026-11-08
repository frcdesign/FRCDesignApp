/**
 * Fires one Onshape call over and over to find where Onshape starts answering
 * 429, then calls once at a time until it stops, to see how long that takes.
 */
import type { OnshapeCallResult } from "@backend/features/testbench/contract";

export interface BurstOptions {
    total: number;
    concurrency: number;
    /** Stop the burst at the first 429 and start watching for the reset. */
    stopOnLimit: boolean;
    /** Seconds between calls while watching for the reset. */
    pollSeconds: number;
    /** Give up watching after this long. */
    maxWaitSeconds: number;
}

export enum BurstPhase {
    BURST = "burst",
    RECOVERY = "recovery"
}

export interface BurstSample {
    /** In the order calls were started. */
    index: number;
    phase: BurstPhase;
    /** Milliseconds from the burst's start to this call's. */
    startedAtMs: number;
    /** Round trip from the page, the Worker included. */
    roundTripMs: number;
    /** Undefined when the call never got an answer from Onshape. */
    status?: number;
    /** Onshape's own time, measured by the Worker. */
    onshapeMs?: number;
    headers: Record<string, string>;
    error?: string;
}

export type BurstSend = () => Promise<OnshapeCallResult>;

const TOO_MANY_REQUESTS = 429;

export async function runBurst(
    send: BurstSend,
    options: BurstOptions,
    onSample: (sample: BurstSample) => void,
    signal: AbortSignal
): Promise<void> {
    const start = performance.now();
    let next = 0;
    let limited = false;
    // The app's own refusal, such as a lapsed session, measures nothing.
    let halted = false;

    const call = async (phase: BurstPhase): Promise<BurstSample> => {
        const index = next++;
        const startedAt = performance.now();
        const base = {
            index,
            phase,
            startedAtMs: Math.round(startedAt - start)
        };
        let sample: BurstSample;
        try {
            const result = await send();
            sample = {
                ...base,
                roundTripMs: Math.round(performance.now() - startedAt),
                status: result.status,
                onshapeMs: result.durationMs,
                headers: result.headers
            };
        } catch (error) {
            sample = {
                ...base,
                roundTripMs: Math.round(performance.now() - startedAt),
                headers: {},
                error: error instanceof Error ? error.message : String(error)
            };
        }
        onSample(sample);
        return sample;
    };

    const worker = async () => {
        while (next < options.total && !signal.aborted && !limited && !halted) {
            const sample = await call(BurstPhase.BURST);
            if (sample.status === undefined) {
                halted = true;
            } else if (
                sample.status === TOO_MANY_REQUESTS &&
                options.stopOnLimit
            ) {
                limited = true;
            }
        }
    };
    await Promise.all(
        Array.from({ length: Math.max(1, options.concurrency) }, worker)
    );

    if (!limited || halted) {
        return;
    }
    const giveUpAt = performance.now() + options.maxWaitSeconds * 1000;
    while (!signal.aborted && performance.now() < giveUpAt) {
        await wait(options.pollSeconds * 1000, signal);
        if (signal.aborted) {
            return;
        }
        const sample = await call(BurstPhase.RECOVERY);
        if (
            sample.status !== undefined &&
            sample.status !== TOO_MANY_REQUESTS
        ) {
            return;
        }
    }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true }
        );
    });
}

/** Names Onshape might put a limit, a count left or a reset time under. */
export function isLimitHeader(name: string): boolean {
    return /rate|limit|retry|quota|remaining|reset|throttl/i.test(name);
}

export interface LimitHeader {
    name: string;
    first: string;
    last: string;
    /** Every distinct value seen, in the order first seen. */
    values: string[];
}

export interface BurstSummary {
    sent: number;
    ok: number;
    limited: number;
    /** Any other status, or no answer. */
    failed: number;
    elapsedMs: number;
    /** Over the burst phase, up to and including the first 429. */
    requestsPerSecond: number;
    roundTripP50?: number;
    roundTripP95?: number;
    onshapeP50?: number;
    /** The first call Onshape answered 429, by index and when it started. */
    firstLimit?: { index: number; startedAtMs: number; okBefore: number };
    /** The first call after the first 429 that wasn't one. */
    recoveredAfterMs?: number;
    limitHeaders: LimitHeader[];
    /** Every status seen, with how many times. */
    statuses: Record<string, number>;
}

export function summarizeBurst(samples: BurstSample[]): BurstSummary {
    const ordered = [...samples].sort((a, b) => a.index - b.index);
    const isOk = (sample: BurstSample) =>
        sample.status !== undefined &&
        sample.status >= 200 &&
        sample.status < 300;
    const isLimited = (sample: BurstSample) =>
        sample.status === TOO_MANY_REQUESTS;

    const statuses: Record<string, number> = {};
    for (const sample of ordered) {
        const key = sample.status?.toString() ?? "no answer";
        statuses[key] = (statuses[key] ?? 0) + 1;
    }

    const first = ordered.find(isLimited);
    const firstLimit = first && {
        index: first.index,
        startedAtMs: first.startedAtMs,
        okBefore: ordered.filter(
            (sample) => sample.index < first.index && isOk(sample)
        ).length
    };
    const recovered =
        first &&
        ordered.find(
            (sample) =>
                sample.startedAtMs > first.startedAtMs &&
                sample.status !== undefined &&
                !isLimited(sample)
        );

    const window = ordered.filter(
        (sample) =>
            sample.phase === BurstPhase.BURST &&
            (!first || sample.index <= first.index)
    );
    const windowMs = Math.max(
        1,
        ...window.map((sample) => sample.startedAtMs + sample.roundTripMs)
    );

    const end = Math.max(
        0,
        ...ordered.map((sample) => sample.startedAtMs + sample.roundTripMs)
    );

    return {
        sent: ordered.length,
        ok: ordered.filter(isOk).length,
        limited: ordered.filter(isLimited).length,
        failed: ordered.filter((sample) => !isOk(sample) && !isLimited(sample))
            .length,
        elapsedMs: end,
        requestsPerSecond: window.length / (windowMs / 1000),
        roundTripP50: percentile(
            ordered.map((sample) => sample.roundTripMs),
            0.5
        ),
        roundTripP95: percentile(
            ordered.map((sample) => sample.roundTripMs),
            0.95
        ),
        onshapeP50: percentile(
            ordered.flatMap((sample) =>
                sample.onshapeMs === undefined ? [] : [sample.onshapeMs]
            ),
            0.5
        ),
        firstLimit,
        recoveredAfterMs:
            first && recovered
                ? recovered.startedAtMs - first.startedAtMs
                : undefined,
        limitHeaders: collectLimitHeaders(ordered),
        statuses
    };
}

function collectLimitHeaders(samples: BurstSample[]): LimitHeader[] {
    const byName = new Map<string, LimitHeader>();
    for (const sample of samples) {
        for (const [name, value] of Object.entries(sample.headers)) {
            if (!isLimitHeader(name)) {
                continue;
            }
            const header = byName.get(name);
            if (!header) {
                byName.set(name, {
                    name,
                    first: value,
                    last: value,
                    values: [value]
                });
                continue;
            }
            header.last = value;
            if (!header.values.includes(value)) {
                header.values.push(value);
            }
        }
    }
    return [...byName.values()];
}

function percentile(values: number[], fraction: number): number | undefined {
    if (values.length === 0) {
        return undefined;
    }
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[
        Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))
    ];
}
