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
    /** The one child to push to; absent for every child. */
    target?: LinkedWorkspace;
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
    /** The one parent to pull from; absent for every parent. */
    source?: LinkedWorkspace;
    sources: string[];
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
                sources={props.sources}
                modalId={modalId}
            />
        )
    });
}
