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

/**
 * Calls again when Onshape answers 5xx. A timeout is not retried: Onshape
 * finishes a call it was slow to answer, so a second would insert the part
 * twice. The user is told `stillRunningMessage` instead of a failure.
 */
export async function retryInsert<T>(
    call: (timeoutMs: number) => Promise<T>,
    stillRunningMessage: string,
    policy: InsertRetry = INSERT_RETRY
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await call(policy.timeoutMs);
        } catch (error) {
            if (error instanceof OnshapeTimeoutError) {
                console.warn(`Insert still running: ${describeError(error)}`);
                throw handledError(
                    stillRunningMessage,
                    HttpStatus.GATEWAY_TIMEOUT
                );
            }
            if (attempt >= policy.retries || !isServerError(error)) {
                throw error;
            }
            console.warn(`Insert failed; retrying: ${describeError(error)}`);
            await new Promise((resolve) => setTimeout(resolve, policy.delayMs));
        }
    }
}
