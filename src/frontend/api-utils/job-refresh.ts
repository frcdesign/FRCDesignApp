import { useEffect, useRef } from "react";
import { useRefreshLibrary } from "./refresh";
import { showSuccessToast } from "../common/notifications";

/**
 * Refreshes the library view when a running job finishes — i.e. when the polled
 * job status flips from running back to idle — and reports it.
 */
export function useRefreshLibraryOnJobFinish(running: boolean): void {
    const refreshLibrary = useRefreshLibrary();
    const wasRunning = useRef(running);
    useEffect(() => {
        if (wasRunning.current && !running) {
            void refreshLibrary();
            showSuccessToast("Library finished loading.");
        }
        wasRunning.current = running;
    }, [running, refreshLibrary]);
}
