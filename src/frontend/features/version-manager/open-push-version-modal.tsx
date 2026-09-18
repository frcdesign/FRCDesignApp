import {
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { openAppModal } from "../../components/open-app-modal";
import { PushVersionForm } from "./components/push-version-modal";

/**
 * Kept out of the component file so that file exports only components, which
 * is what lets React Refresh swap it in place instead of reloading its callers.
 *
 * `target` narrows the push to one linked workspace, which is what a row's own
 * push button asks for; the version still has to be named either way.
 */
export function openPushVersionModal(
    workspace: WorkspacePath,
    downstream: LinkedWorkspace[],
    target?: LinkedWorkspace
): void {
    const modalId = "push-version";
    openAppModal({
        modalId,
        title: target ? `Push to ${targetName(target)}` : "Push version",
        children: (
            <PushVersionForm
                workspace={workspace}
                downstream={downstream}
                target={target}
                modalId={modalId}
            />
        )
    });
}

function targetName(target: LinkedWorkspace): string {
    return target.documentName ?? "the linked workspace";
}
