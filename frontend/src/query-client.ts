import { QueryClient } from "@tanstack/react-query";
import { HandledBackendError } from "./api/errors";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => {
                if (count >= 3) {
                    return false;
                } else if (error instanceof HandledBackendError) {
                    return false;
                }
                return true;
            }
        }
    }
});
