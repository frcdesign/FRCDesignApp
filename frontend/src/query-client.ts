import { QueryClient } from "@tanstack/react-query";
import { ReportedError } from "./api/errors";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => {
                if (count >= 4) {
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
