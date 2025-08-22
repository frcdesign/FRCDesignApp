import { QueryClient } from "@tanstack/react-query";
import { ReportedError } from "./api/errors";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: Infinity,
            gcTime: 60 * 1000,
            retry: (count, error) => {
                if (count >= 3) {
                    return false;
                }
                if (error instanceof ReportedError) {
                    return false;
                }
                return true;
            }
        }
    }
});
