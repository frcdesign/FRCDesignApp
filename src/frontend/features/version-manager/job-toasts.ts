import { useEffect, useRef } from "react";
import {
    VersionJobState,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import {
    renderNotification,
    showErrorToast,
    showSuccessToast,
    showWarningToast
} from "../../lib/notifications";
import { describeJob, JobOutcome, jobOutcome } from "./job-report";
import { openJobDetails } from "./open-version-modals";
import { useVersionJobQuery } from "./queries";

/**
 * One toast for the run going, so a second push replaces the first's result
 * rather than stacking under it.
 */
const JOB_TOAST_ID = "version-job";

function showJobToast(status: VersionJobStatus): void {
    const message = describeJob(status);
    const outcome = jobOutcome(status);
    if (outcome === JobOutcome.SUCCESS) {
        showSuccessToast(message, JOB_TOAST_ID);
        return;
    }
    // Up until dismissed: somebody has something to do about these, and a
    // toast that left on its own took the what with it.
    const withDetails = renderNotification(
        message,
        (status.result?.failures.length ?? 0) > 0
            ? { text: "Details", onClick: () => openJobDetails(status) }
            : undefined
    );
    if (outcome === JobOutcome.PARTIAL) {
        showWarningToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    } else if (outcome === JobOutcome.FAILED) {
        showErrorToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    }
}

/**
 * Reports a run once it finishes, to whoever was watching it go.
 *
 * While it is going, the button that started it carries a spinner, which is
 * where somebody watching for it is already looking. What they cannot see there
 * is what it did, so that arrives as a toast at the end; the page keeps the same
 * report for whoever opens it afterwards.
 */
export function useVersionJobToasts(
    workspace: WorkspacePath | undefined
): void {
    const { data } = useVersionJobQuery(workspace);
    // A ref, not state: noticing the transition should not trigger a render,
    // and a state write from an effect is not how this app tracks one.
    const wasRunning = useRef(false);

    useEffect(() => {
        const isRunning = data?.state === VersionJobState.RUNNING;
        if (wasRunning.current && !isRunning && data) {
            showJobToast(data);
        }
        wasRunning.current = isRunning;
    }, [data]);
}
