import { useEffect, useRef } from "react";
import {
    jobOutcome,
    VersionJobOutcome,
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
import { useTargetWorkspace } from "../../lib/onshape-params";
import { queryClient } from "../../lib/query-client";
import { workspaceLinksQueryKey } from "../../lib/query-keys";
import { jobHeadline } from "./job-report";
import { openJobDetails } from "./open-version-modals";
import { useVersionJobQuery } from "./queries";

/**
 * One toast for the run going, so a second push replaces the first's result
 * rather than stacking under it.
 */
const JOB_TOAST_ID = "version-job";

function showJobToast(
    status: VersionJobStatus,
    workspace: WorkspacePath
): void {
    const outcome = jobOutcome(status);
    if (!outcome) {
        return;
    }
    const message = `${jobHeadline(status, outcome)}.`;
    if (outcome === VersionJobOutcome.SUCCESS) {
        showSuccessToast(message, JOB_TOAST_ID);
        return;
    }
    // Up until closed: somebody has something to do about these.
    const withDetails = renderNotification(message, {
        text: "Details",
        onClick: () => openJobDetails(workspace)
    });
    if (outcome === VersionJobOutcome.PARTIAL) {
        showWarningToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    } else {
        showErrorToast(withDetails, JOB_TOAST_ID, { autoClose: false });
    }
}

/**
 * Reports a run once it finishes, to whoever watched it go, and brings the
 * links it moved up to date. Mounted in the app shell, so a run started here
 * still reports from a library.
 */
export function useVersionJobToasts(): void {
    const workspace = useTargetWorkspace();
    const { data } = useVersionJobQuery(workspace);
    // A ref, not state: noticing the transition should not trigger a render.
    const wasRunning = useRef(false);

    useEffect(() => {
        const isRunning = data?.state === VersionJobState.RUNNING;
        if (wasRunning.current && !isRunning && data && workspace) {
            showJobToast(data, workspace);
            void queryClient.invalidateQueries({
                queryKey: workspaceLinksQueryKey(workspace)
            });
        }
        wasRunning.current = isRunning;
    }, [data, workspace]);
}
