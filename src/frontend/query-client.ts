import { QueryClient } from "@tanstack/react-query";
import { HandledError } from "./api-utils/errors";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => {
                // Only retry once
                if (count >= 2) {
                    return false;
                } else if (error instanceof HandledError) {
                    return false;
                }
                return true;
            }
        }
    }
});
