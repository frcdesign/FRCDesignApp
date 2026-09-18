import { useEffect, useRef } from "react";
import {
    VersionJobState,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { showErrorToast, showSuccessToast } from "../../lib/notifications";
import { describeJobResult, useVersionJobQuery } from "./queries";

/**
 * Reports a run once it finishes.
 *
 * While it is going, the button that started it carries a spinner, which is
 * where somebody watching for it is already looking. What they cannot see there
 * is what it did — how many tabs moved, and whether any would not — so that
 * arrives as a toast at the end.
 */
export function useVersionJobToasts(
    workspace: WorkspacePath | undefined
): void {
    const { data } = useVersionJobQuery(workspace);
    const state = data?.state;
    // A ref, not state: noticing the transition should not trigger a render,
    // and a state write from an effect is not how this app tracks one.
    const wasRunning = useRef(false);

    useEffect(() => {
        if (wasRunning.current && state !== VersionJobState.RUNNING) {
            if (state === VersionJobState.COMPLETE) {
                showSuccessToast(
                    data?.result
                        ? describeJobResult(data.result)
                        : "Finished updating Onshape."
                );
            } else if (state === VersionJobState.FAILED) {
                showErrorToast(
                    data?.error ??
                        "The push or pull failed. If it keeps happening, contact the FRCDesignApp developers."
                );
            }
        }
        wasRunning.current = state === VersionJobState.RUNNING;
    }, [state, data?.result, data?.error]);
}
