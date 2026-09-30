import {
    type LinkedWorkspace,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppModalBody } from "../../components/app-modal";
import { openAppModal } from "../../components/open-app-modal";
import { JobDetails } from "./components/job-details";
import { PullReferencesForm } from "./components/pull-references-modal";
import { PushVersionForm } from "./components/push-version-modal";
import { jobHeadline, JobOutcome, jobOutcome } from "./job-report";

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

/** How a run went, from its toast. */
export function openJobDetails(status: VersionJobStatus): void {
    openAppModal({
        title: jobHeadline(status, jobOutcome(status) ?? JobOutcome.FAILED),
        children: (
            <AppModalBody>
                <JobDetails status={status} />
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
