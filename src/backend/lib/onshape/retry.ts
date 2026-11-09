import { HttpStatus } from "http-status-ts";
import { OnshapeApiError, OnshapeTimeoutError } from "./client";

export interface InsertRetry {
    retries: number;
    delayMs: number;
    /** Per attempt. Most inserts answer in a few seconds; about 1% of those that succeed take longer. */
    timeoutMs: number;
}

export const INSERT_RETRY: InsertRetry = {
    retries: 1,
    delayMs: 1000,
    timeoutMs: 20_000
};

/** A 5xx, or no answer at all. */
function isWorthRetrying(error: unknown): error is Error {
    return (
        error instanceof OnshapeTimeoutError ||
        (error instanceof OnshapeApiError &&
            error.status >= HttpStatus.INTERNAL_SERVER_ERROR)
    );
}

/**
 * Calls again when Onshape answers 5xx or times out. Onshape may still finish
 * a call that timed out, so a retry can insert the part twice: a part inserted
 * twice is better than none.
 */
export async function retryInsert<T>(
    call: (timeoutMs: number) => Promise<T>,
    policy: InsertRetry = INSERT_RETRY
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await call(policy.timeoutMs);
        } catch (error) {
            if (attempt >= policy.retries || !isWorthRetrying(error)) {
                throw error;
            }
            console.warn("Insert failed; retrying", error);
            await new Promise((resolve) => setTimeout(resolve, policy.delayMs));
        }
    }
}
