import { useEffect, useRef } from "react";
import {
    assemblyKey,
    assemblyJobOutcome,
    AssemblyJobOutcome,
    AssemblyJobState,
    type AssemblyJobStatus
} from "@backend/features/auto-assembly/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import {
    renderNotification,
    showErrorToast,
    showLoadingToast,
    showSuccessToast,
    showWarningToast
} from "../../lib/notifications";
import { useTargetAssembly } from "../../lib/onshape-params";
import { jobHeadline } from "./job-report";
import { openJobDetails } from "./open-job-details";
import { useAssemblyJobQuery } from "./queries";

/** One toast for the run going, so a second run replaces the first's result rather than stacking under it. */
const JOB_TOAST_ID = "assembly-job";

function showJobToast(status: AssemblyJobStatus, assembly: ElementPath): void {
    const outcome = assemblyJobOutcome(status);
    if (!outcome) {
        return;
    }
    const message = `${jobHeadline(status, outcome)}.`;
    if (outcome === AssemblyJobOutcome.SUCCESS) {
        showSuccessToast(message, JOB_TOAST_ID);
        return;
    }
    // Up until closed: somebody has something to do about these
    const withDetails = renderNotification(message, {
        text: "Details",
        onClick: () => openJobDetails(assembly)
    });
    if (outcome === AssemblyJobOutcome.PARTIAL) {
        showWarningToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    } else {
        showErrorToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    }
}

/**
 * Says a run is inserting, then how it finished, in the same toast, to
 * whoever watched it go. Mounted in the app shell, so a run started here still
 * reports from a library.
 */
export function useAssemblyJobToasts(): void {
    const assembly = useTargetAssembly();
    const { data } = useAssemblyJobQuery(assembly);
    // A ref, not state: noticing the transition should not trigger a render
    const wasRunning = useRef<string | undefined>(undefined);

    useEffect(() => {
        const key = assembly && assemblyKey(assembly);
        const isRunning = data?.state === AssemblyJobState.RUNNING;
        if (wasRunning.current === key && !isRunning && data && assembly) {
            showJobToast(data, assembly);
        }
        if (isRunning && wasRunning.current !== key) {
            showLoadingToast("Inserting fasteners...", JOB_TOAST_ID);
        }
        wasRunning.current = isRunning ? key : undefined;
    }, [data, assembly]);
}
