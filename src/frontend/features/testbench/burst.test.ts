import { describe, expect, it } from "vitest";
import type { OnshapeCallResult } from "@backend/features/testbench/contract";
import {
    BurstPhase,
    runBurst,
    summarizeBurst,
    type BurstOptions,
    type BurstSample
} from "./burst";

const OPTIONS: BurstOptions = {
    total: 10,
    concurrency: 2,
    stopOnLimit: true,
    pollSeconds: 0.001,
    maxWaitSeconds: 5
};

/** Onshape answering each call in turn with the next status. */
function answering(statuses: number[]) {
    let next = 0;
    return (): Promise<OnshapeCallResult> => {
        const status = statuses[Math.min(next++, statuses.length - 1)];
        const result: OnshapeCallResult = {
            url: "https://cad.onshape.com/api/v17/x",
            status,
            durationMs: 5,
            headers:
                status === 429
                    ? { "retry-after": "30", "content-type": "json" }
                    : { "content-type": "json" }
        };
        return Promise.resolve(result);
    };
}

async function run(statuses: number[], options = OPTIONS) {
    const samples: BurstSample[] = [];
    await runBurst(
        answering(statuses),
        options,
        (sample) => samples.push(sample),
        new AbortController().signal
    );
    return samples;
}

describe("runBurst", () => {
    it("makes every call when Onshape never limits", async () => {
        const samples = await run([200]);
        expect(samples).toHaveLength(10);
        expect(samples.every((s) => s.phase === BurstPhase.BURST)).toBe(true);
    });

    it("stops at a 429, then calls once at a time until it lifts", async () => {
        const samples = await run([200, 200, 200, 429, 429, 429, 200]);
        const recovery = samples.filter((s) => s.phase === BurstPhase.RECOVERY);
        expect(recovery.map((s) => s.status)).toEqual([429, 200]);
        expect(samples.length).toBeLessThan(10);
    });

    it("keeps going past a 429 when told to", async () => {
        const samples = await run([200, 429], {
            ...OPTIONS,
            stopOnLimit: false
        });
        expect(samples).toHaveLength(10);
    });

    it("stops at a call the Worker refused, recording it without an answer", async () => {
        const samples: BurstSample[] = [];
        await runBurst(
            () => Promise.reject(new Error("403")),
            { ...OPTIONS, concurrency: 1 },
            (sample) => samples.push(sample),
            new AbortController().signal
        );
        expect(samples).toMatchObject([{ error: "403" }]);
        expect(samples[0].status).toBeUndefined();
    });
});

function sample(
    index: number,
    startedAtMs: number,
    status: number | undefined,
    headers: Record<string, string> = {},
    phase = BurstPhase.BURST
): BurstSample {
    return { index, phase, startedAtMs, roundTripMs: 100, status, headers };
}

describe("summarizeBurst", () => {
    it("says when Onshape first limited, and when it lifted", () => {
        const summary = summarizeBurst([
            sample(0, 0, 200, { "x-ratelimit-remaining": "2" }),
            sample(1, 100, 200, { "x-ratelimit-remaining": "1" }),
            sample(2, 200, 429, { "retry-after": "30" }),
            sample(3, 250, 429),
            sample(4, 10_200, 429, {}, BurstPhase.RECOVERY),
            sample(5, 30_200, 200, {}, BurstPhase.RECOVERY)
        ]);

        expect(summary).toMatchObject({
            sent: 6,
            ok: 3,
            limited: 3,
            failed: 0,
            firstLimit: { index: 2, startedAtMs: 200, okBefore: 2 },
            recoveredAfterMs: 30_000,
            statuses: { "200": 3, "429": 3 }
        });
        expect(summary.limitHeaders).toEqual([
            {
                name: "x-ratelimit-remaining",
                first: "2",
                last: "1",
                values: ["2", "1"]
            },
            { name: "retry-after", first: "30", last: "30", values: ["30"] }
        ]);
        // Three calls up to the first 429, the last ending at 300 ms.
        expect(summary.requestsPerSecond).toBe(10);
    });

    it("counts a call without an answer as failed, and finds no limit", () => {
        const summary = summarizeBurst([
            sample(0, 0, 200),
            sample(1, 0, undefined)
        ]);
        expect(summary).toMatchObject({ ok: 1, failed: 1, limited: 0 });
        expect(summary.firstLimit).toBeUndefined();
        expect(summary.recoveredAfterMs).toBeUndefined();
    });
});
