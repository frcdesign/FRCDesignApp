/** What the navbar offers: where each tab goes, and how it is spelled. */
import { useNavigate } from "@tanstack/react-router";
import * as z from "zod";
import { LibraryId } from "@backend/features/library/library-id";
import {
    type AppTab,
    getTabPath,
    isLibraryTab,
    UtilityTab
} from "@backend/features/settings/app-tab";
import { getLibraryName } from "./library";

/** In navbar order. A utility joins once it has a page. */
export const APP_TABS: AppTab[] = Object.values(LibraryId);

/** A tab id as the entry redirect spells it into the url. */
export const AppTabType = z.enum([
    ...Object.values(LibraryId),
    ...Object.values(UtilityTab)
]);

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
