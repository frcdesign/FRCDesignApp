import { QueryClient } from "@tanstack/react-query";
import { AppError } from "./errors";
import { ApiErrorKind } from "@backend/lib/api-error";

/** Retries a failure up to `retries` times, unless the backend meant its answer. */
export function retryUnexpected(retries: number) {
    return (count: number, error: Error): boolean => {
        if (count >= retries) {
            return false;
        }
        return !(
            error instanceof AppError &&
            error.body.kind !== ApiErrorKind.INTERNAL
        );
    };
}

export const queryClient = new QueryClient({
    defaultOptions: {
        // A browser can report offline while requests still go through, and
        // in "online" mode every fetch, a route loader's included, waits for it.
        queries: {
            networkMode: "always",
            retry: retryUnexpected(2)
        },
        mutations: {
            networkMode: "always"
        }
    }
});
