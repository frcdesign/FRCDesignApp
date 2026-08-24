import { openAppModal } from "../../components/open-app-modal";
import { AppModalBody } from "../../components/app-modal";
import { SettingsMenuContent } from "./components/settings-menu";

/**
 * Kept out of the component file so that file exports only components, which
 * is what lets React Refresh swap it in place instead of reloading its callers.
 */
export function openSettingsMenu() {
    openAppModal({
        title: "Settings",
        children: (
            // The setting rows carry their own spacing.
            <AppModalBody gap={0}>
                <SettingsMenuContent />
            </AppModalBody>
        )
    });
}
