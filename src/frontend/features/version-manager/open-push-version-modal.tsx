import {
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { openAppModal } from "../../components/open-app-modal";
import { PushVersionForm } from "./components/push-version-modal";

/**
 * Kept out of the component file so that file exports only components, which
 * is what lets React Refresh swap it in place instead of reloading its callers.
 */
export function openPushVersionModal(
    workspace: WorkspacePath,
    downstream: LinkedWorkspace[]
): void {
    const modalId = "push-version";
    openAppModal({
        modalId,
        title: "Push version",
        children: (
            <PushVersionForm
                workspace={workspace}
                downstream={downstream}
                modalId={modalId}
            />
        )
    });
}
