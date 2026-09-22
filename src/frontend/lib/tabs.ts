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

/**
 * The tabs the app can open, in the order the navbar offers them. A utility
 * joins this once it has a page; `AppTab` already lets one be stored.
 */
export const APP_TABS: AppTab[] = Object.values(LibraryId);

/** A tab id as the entry redirect spells it into the url. */
export const AppTabType = z.enum([
    ...Object.values(LibraryId),
    ...Object.values(UtilityTab)
]);

/**
 * Navigates to a tab. A library is one route with a parameter, so it is named;
 * a utility is a route of its own, which `href` reaches without this route tree
 * having to know it yet — a relative one still navigates in place.
 */
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
