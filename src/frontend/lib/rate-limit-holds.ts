/**
 * Features holding off Onshape after it limited them, until the wait its
 * `Retry-After` gave runs out. Onshape limits each endpoint on its own, so
 * each feature holds on its own; kept in this browser, as the panel reopens.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rateLimitedMessage } from "@backend/lib/onshape/failures";
import { AppError, appError } from "./errors";

/** Each a group of routes that stops calling on its own 429. */
export enum HoldScope {
    /** Its check, prepare and run. */
    AUTO_ASSEMBLY = "auto-assembly",
    /** Inserting into an assembly or Part Studio, fastened or not. */
    INSERT = "insert",
    INSERT_LOCATION = "insert-location"
}

interface HoldState {
    /** When each held feature may call again, in epoch milliseconds. */
    holds: Partial<Record<HoldScope, number>>;
    /** When the holds were last looked at, so the wait shown counts down without reading the clock in render. */
    now: number;
}

/** How often the wait shown is brought up to date. */
const TICK_MS = 60 * 1000;

let timer: ReturnType<typeof setTimeout> | undefined;

/** Drops the holds that have run out, and comes back at the next one's end or a minute, whichever is sooner. */
function tick(): void {
    clearTimeout(timer);
    timer = undefined;
    const now = Date.now();
    const holds = Object.fromEntries(
        Object.entries(useRateLimitHolds.getState().holds).filter(
            ([, until]) => until > now
        )
    );
    useRateLimitHolds.setState({ holds, now });
    const next = Math.min(...Object.values(holds));
    if (Number.isFinite(next)) {
        timer = setTimeout(tick, Math.min(next - now, TICK_MS));
    }
}

/** In localStorage, the persist default, which carries on in memory where the panel can't reach it. */
export const useRateLimitHolds = create<HoldState>()(
    persist((): HoldState => ({ holds: {}, now: Date.now() }), {
        name: "rateLimitHolds",
        partialize: (state) => ({ holds: state.holds })
    })
);

// localStorage hydrates during `create`, so a hold from before a reload counts down from here.
tick();

function secondsLeft(until: number, now: number): number {
    return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Holds `scope` for the wait a 429 gave; anything else passes. */
export function holdOnRateLimit(scope: HoldScope, error: unknown): void {
    if (
        !(error instanceof AppError) ||
        error.body.retryAfterSeconds === undefined
    ) {
        return;
    }
    const until = Date.now() + error.body.retryAfterSeconds * 1000;
    useRateLimitHolds.setState((state) => ({
        holds: { ...state.holds, [scope]: until }
    }));
    tick();
}

/** When `scope` may call again, while it is held; for code outside render. */
function heldUntil(scope: HoldScope): number | undefined {
    const until = useRateLimitHolds.getState().holds[scope];
    return until !== undefined && until > Date.now() ? until : undefined;
}

/** Whether `scope` is held now, for code outside render. */
export function isHeld(scope: HoldScope): boolean {
    return heldUntil(scope) !== undefined;
}

/**
 * Calls Onshape through `call` unless `scope` is held, and holds it on a 429.
 * Held, it fails at once with the wait, as the server would have said it.
 */
export async function unlessHeld<T>(
    scope: HoldScope,
    call: () => Promise<T>
): Promise<T> {
    const until = heldUntil(scope);
    if (until !== undefined) {
        throw appError(rateLimitedMessage(secondsLeft(until, Date.now())));
    }
    try {
        return await call();
    } catch (error) {
        holdOnRateLimit(scope, error);
        throw error;
    }
}

/** What to tell the user while `scope` is held, or undefined when it isn't. */
export function useRateLimitHold(scope: HoldScope): string | undefined {
    return useRateLimitHolds((state) => {
        const until = state.holds[scope];
        return until === undefined
            ? undefined
            : rateLimitedMessage(secondsLeft(until, state.now));
    });
}
