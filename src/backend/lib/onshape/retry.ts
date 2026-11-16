import { HttpStatus } from "http-status-ts";
import { handledError } from "../api-error";
import { describeError } from "../error-text";
import { OnshapeApiError, OnshapeTimeoutError } from "./client";

export interface InsertRetry {
    retries: number;
    delayMs: number;
    /** Per attempt. About 1% of inserts that succeed take over 20 s. */
    timeoutMs: number;
}

export const INSERT_RETRY: InsertRetry = {
    retries: 1,
    delayMs: 1000,
    timeoutMs: 60_000
};

function isServerError(error: unknown): error is OnshapeApiError {
    return (
        error instanceof OnshapeApiError &&
        error.status >= HttpStatus.INTERNAL_SERVER_ERROR
    );
}

export const INSERT_TIMED_OUT =
    "Onshape timed out while inserting. If your part doesn't appear, file a report.";

/**
 * Calls again when Onshape answers 5xx. A timeout is not retried, since the
 * call may still land; the user is told `timedOutMessage` instead.
 */
export async function retryInsert<T>(
    call: (timeoutMs: number) => Promise<T>,
    timedOutMessage: string,
    policy: InsertRetry = INSERT_RETRY
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await call(policy.timeoutMs);
        } catch (error) {
            if (error instanceof OnshapeTimeoutError) {
                console.warn(`Insert timed out: ${describeError(error)}`);
                throw handledError(timedOutMessage, HttpStatus.GATEWAY_TIMEOUT);
            }
            if (attempt >= policy.retries || !isServerError(error)) {
                throw error;
            }
            console.warn(`Insert failed; retrying: ${describeError(error)}`);
            await new Promise((resolve) => setTimeout(resolve, policy.delayMs));
        }
    }
}
