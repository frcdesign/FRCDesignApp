import { QueryClient } from "@tanstack/react-query";
import { HandledError } from "./api/errors";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => {
                if (count >= 3) {
                    return false;
                } else if (error instanceof HandledError) {
                    return false;
                }
                return true;
            }
        }
    }
});
