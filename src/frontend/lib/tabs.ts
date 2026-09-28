/** What the navbar offers: where each tab goes, and how it is spelled. */
import { useNavigate } from "@tanstack/react-router";
import { LibraryId } from "@backend/features/library/library-id";
import { type AppTab, getTabPath, isLibraryTab, UtilityTab } from "./app-tab";
import { getLibraryName } from "./library";
import { useTargetWorkspace } from "./onshape-params";

/**
 * The tabs in navbar order. The version manager acts on the workspace the app
 * was launched from, so without one there is nothing for its page to do and it
 * is not offered.
 */
export function useAppTabs(): AppTab[] {
    const workspace = useTargetWorkspace();
    const libraries: AppTab[] = Object.values(LibraryId);
    return workspace ? [...libraries, UtilityTab.VERSION_MANAGER] : libraries;
}

/** A utility is reached by `href`, so this route tree needn't know it yet. */
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
