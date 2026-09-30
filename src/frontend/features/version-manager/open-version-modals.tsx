import {
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody } from "../../components/app-modal";
import { openAppModal } from "../../components/open-app-modal";
import { JobDetails, JobDetailsTitle } from "./components/job-details";
import { PullReferencesForm } from "./components/pull-references-modal";
import { PushVersionForm } from "./components/push-version-modal";

/**
 * Kept out of the component files so those export only components, which is
 * what lets React Refresh swap them in place instead of reloading their
 * callers.
 */

interface PushModalProps {
    title: string;
    /** The child to push to; a whole direction has no form. */
    target: LinkedWorkspace;
}

export function openPushVersionModal(
    workspace: WorkspacePath,
    props: PushModalProps
): void {
    openAppModal({
        title: props.title,
        children: (
            <PushVersionForm workspace={workspace} target={props.target} />
        )
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

interface PullModalProps {
    title: string;
    /** The parent to pull from; a whole direction has no form. */
    source: LinkedWorkspace;
}

export function openPullReferencesModal(
    workspace: WorkspacePath,
    props: PullModalProps
): void {
    openAppModal({
        title: props.title,
        children: (
            <PullReferencesForm workspace={workspace} source={props.source} />
        )
    });
}
