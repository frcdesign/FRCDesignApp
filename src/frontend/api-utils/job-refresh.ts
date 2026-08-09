import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import { contextDataQueryKey, libraryQueryMatchKey } from "../queries";
import { showSuccessToast } from "../common/notifications";

/**
 * Refreshes the library view when a running job finishes — i.e. when the polled
 * job status flips from running back to idle. Pulls the new cacheVersion,
 * re-runs the route loaders so the freshly-loaded data shows, and reports it.
 */
export function useRefreshLibraryOnJobFinish(running: boolean): void {
    const router = useRouter();
    const wasRunning = useRef(running);
    useEffect(() => {
        if (wasRunning.current && !running) {
            void (async () => {
                await queryClient.refetchQueries({
                    queryKey: contextDataQueryKey()
                });
                await queryClient.invalidateQueries({
                    queryKey: libraryQueryMatchKey()
                });
                void router.invalidate();
            })();
            showSuccessToast("Library finished loading.");
        }
        wasRunning.current = running;
    }, [running, router]);
}
