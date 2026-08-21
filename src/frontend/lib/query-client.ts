import { QueryClient } from "@tanstack/react-query";
import { AppError } from "./errors";
import { ApiErrorKind } from "@backend/lib/api-error";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => {
                // Only retry once
                if (count >= 2) {
                    return false;
                }
                // Retrying will not change an answer the backend meant.
                if (
                    error instanceof AppError &&
                    error.kind !== ApiErrorKind.INTERNAL
                ) {
                    return false;
                }
                return true;
            }
        }
    }
});
