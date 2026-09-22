import {
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { openAppModal } from "../../components/open-app-modal";
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
    targets: string[];
}

export function openPushVersionModal(
    workspace: WorkspacePath,
    props: PushModalProps
): void {
    const modalId = "push-version";
    openAppModal({
        modalId,
        title: props.title,
        children: (
            <PushVersionForm
                workspace={workspace}
                target={props.target}
                targets={props.targets}
                modalId={modalId}
            />
        )
    });
}

interface PullModalProps {
    title: string;
    /** The parent to pull from; a whole direction has no form. */
    source: LinkedWorkspace;
    sourceName: string;
}

export function openPullReferencesModal(
    workspace: WorkspacePath,
    props: PullModalProps
): void {
    const modalId = "pull-references";
    openAppModal({
        modalId,
        title: props.title,
        children: (
            <PullReferencesForm
                workspace={workspace}
                source={props.source}
                sourceName={props.sourceName}
                modalId={modalId}
            />
        )
    });
}
