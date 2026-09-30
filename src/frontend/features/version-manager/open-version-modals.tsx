/** Kept out of the component files, so those export only components for React Refresh. */
import {
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody } from "../../components/app-modal";
import { openAppModal } from "../../components/open-app-modal";
import { JobDetails, JobDetailsTitle } from "./components/job-details";
import { PullReferencesForm } from "./components/pull-references-modal";
import { PushVersionForm } from "./components/push-version-modal";

function documentName(linked: LinkedWorkspace): string {
    return linked.documentName ?? "Untitled document";
}

/** The form for one child. A whole direction has none: one name cannot stand for the several versions it cuts. */
export function openPushVersionModal(
    workspace: WorkspacePath,
    target: LinkedWorkspace
): void {
    openAppModal({
        title: `Push to ${documentName(target)}`,
        children: <PushVersionForm workspace={workspace} target={target} />
    });
}

export function openPullReferencesModal(
    workspace: WorkspacePath,
    source: LinkedWorkspace
): void {
    openAppModal({
        title: `Pull from ${documentName(source)}`,
        children: <PullReferencesForm workspace={workspace} source={source} />
    });
}

/** How the run this workspace last started is going, or went. */
export function openJobDetails(workspace: WorkspacePath): void {
    openAppModal({
        title: <JobDetailsTitle workspace={workspace} />,
        children: (
            <AppModalBody>
                <JobDetails workspace={workspace} />
            </AppModalBody>
        )
    });
}
