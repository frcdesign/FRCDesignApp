/** Where each tab goes, and how it is spelled. */
import { useNavigate } from "@tanstack/react-router";
import { type AppTab, getTabPath, isLibraryTab, UtilityTab } from "./app-tab";
import { getLibraryName } from "./library";
import { updateUiState } from "./ui-state";
import { m } from "../paraglide/messages";

export function useNavigateToTab(): (tabId: AppTab) => void {
    const navigate = useNavigate();

    return (tabId) => {
        if (isLibraryTab(tabId)) {
            void navigate({
                to: "/app/library/$libraryId",
                params: { libraryId: tabId }
            });
            return;
        }
        void navigate({ href: getTabPath(tabId) });
    };
}

/** Goes to the tab, and makes it the one the app opens to next time. */
export function useSelectTab(): (tabId: AppTab) => void {
    const navigateToTab = useNavigateToTab();
    return (tabId) => {
        updateUiState({ tabId });
        navigateToTab(tabId);
    };
}

export function getTabName(tabId: AppTab): string {
    return isLibraryTab(tabId) ? getLibraryName(tabId) : getUtilityName(tabId);
}

function getUtilityName(tabId: UtilityTab): string {
    switch (tabId) {
        case UtilityTab.VERSION_MANAGER:
            return m.versionManagerTabName();
        case UtilityTab.DESIGN_CHECK:
            return m.designCheckTabName();
    }
}
