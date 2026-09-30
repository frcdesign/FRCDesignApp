/** Where each tab goes, and how it is spelled. */
import { useNavigate } from "@tanstack/react-router";
import { type AppTab, getTabPath, isLibraryTab, UtilityTab } from "./app-tab";
import { getLibraryName } from "./library";

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

export function getTabName(tabId: AppTab): string {
    return isLibraryTab(tabId) ? getLibraryName(tabId) : getUtilityName(tabId);
}

function getUtilityName(tabId: UtilityTab): string {
    switch (tabId) {
        case UtilityTab.VERSION_MANAGER:
            return "Version Manager";
    }
}
