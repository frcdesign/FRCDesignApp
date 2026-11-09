import { HttpStatus } from "http-status-ts";
import { OnshapeApiError } from "./client";

export interface ServerErrorRetry {
    retries: number;
    delayMs: number;
}

/** Enough to ride out a blip without keeping someone waiting on a toast. */
export const SERVER_ERROR_RETRY: ServerErrorRetry = {
    retries: 1,
    delayMs: 1000
};

function isServerError(error: unknown): error is OnshapeApiError {
    return (
        error instanceof OnshapeApiError &&
        error.status >= HttpStatus.INTERNAL_SERVER_ERROR
    );
}

/**
 * Calls again when Onshape answers 5xx. A timeout is not retried: Onshape may
 * still finish the first call, and a second would do the work twice.
 */
export async function retryOnServerError<T>(
    call: () => Promise<T>,
    policy: ServerErrorRetry = SERVER_ERROR_RETRY
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await call();
        } catch (error) {
            if (attempt >= policy.retries || !isServerError(error)) {
                throw error;
            }
            console.warn(`Onshape answered ${error.status}; retrying`, error);
            await new Promise((resolve) => setTimeout(resolve, policy.delayMs));
        }
    }
}
