import { modals } from "@mantine/modals";
import { SettingsMenuContent } from "./components/settings-menu";

/**
 * Kept out of the component file so that file exports only components, which
 * is what lets React Refresh swap it in place instead of reloading its callers.
 */
export function openSettingsMenu() {
    modals.open({
        title: "Settings",
        centered: true,
        children: <SettingsMenuContent />
    });
}
