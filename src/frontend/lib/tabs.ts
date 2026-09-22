/** Which tab is showing, and how each one is spelled to the user. */
import { notFound, useParams } from "@tanstack/react-router";
import * as z from "zod";
import { LibraryId } from "@backend/features/library/library-id";
import {
    type AppTab,
    isLibraryTab,
    UtilityTab
} from "@backend/features/settings/app-tab";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";
import { getLibraryName } from "./library";

/**
 * The tabs the app can open, in the order the navbar offers them. A utility
 * joins the list once it has a page of its own; until then `AppTab` is what
 * lets one be stored and resumed, and this is what can be reached.
 */
export const APP_TABS: AppTab[] = Object.values(LibraryId);

/** Returns the tab being displayed, which the url is the source of truth for. */
export function useTabId(): AppTab {
    // Callers can sit outside the tab route — modals mount at the root and
    // error components replace the match — so fall back instead of throwing.
    const params = useParams({ from: "/app/tab/$tabId", shouldThrow: false });
    return params?.tabId ?? DEFAULT_SETTINGS.tabId;
}

const AppTabType = z.enum(APP_TABS);

/**
 * Reads the tab id out of a url. One the app cannot open 404s here rather than
 * falling back, which would hide the bad url and strand the caller elsewhere.
 */
export function parseTabId(tabId: string): AppTab {
    const parsed = AppTabType.safeParse(tabId);
    if (!parsed.success) {
        throw notFound();
    }
    return parsed.data;
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
