import {
    type PushScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { openAppModal } from "../../components/open-app-modal";
import { PushVersionForm } from "./components/push-version-modal";

interface PushVersionModalProps {
    /** What the push reaches, decided by whatever opened this. */
    scope: PushScope;
    title: string;
    /** The children it updates, named for the form to list. */
    targets: string[];
    recursive: boolean;
}

/**
 * Kept out of the component file so that file exports only components, which
 * is what lets React Refresh swap it in place instead of reloading its callers.
 */
export function openPushVersionModal(
    workspace: WorkspacePath,
    props: PushVersionModalProps
): void {
    const modalId = "push-version";
    openAppModal({
        modalId,
        title: props.title,
        children: (
            <PushVersionForm
                workspace={workspace}
                scope={props.scope}
                targets={props.targets}
                recursive={props.recursive}
                modalId={modalId}
            />
        )
    });
}
