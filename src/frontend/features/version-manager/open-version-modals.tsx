import {
    type LinkedWorkspace,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { openAppModal } from "../../components/open-app-modal";
import { JobDetails } from "./components/job-details";
import { PullReferencesForm } from "./components/pull-references-modal";
import { PushVersionForm } from "./components/push-version-modal";
import { jobKindLabel } from "./job-report";

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

/** The tabs a run could not update, from its toast or its callout. */
export function openJobDetails(status: VersionJobStatus): void {
    openAppModal({
        title: `Last ${jobKindLabel(status.kind)}`,
        children: <JobDetails status={status} />
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
