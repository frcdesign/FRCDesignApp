/**
 * What the navbar offers, and so what the app resumes into. Onshape calls its
 * elements tabs too, which is what the `App` in the name holds off.
 */
import { LibraryId } from "../library/library-id";

/** A tab that is not a library, having a page of the app's own instead. */
export enum UtilityTab {
    VERSION_MANAGER = "version-manager"
}

export type AppTab = LibraryId | UtilityTab;

const APP_TABS: string[] = [
    ...Object.values(LibraryId),
    ...Object.values(UtilityTab)
];

export function isLibraryTab(tab: AppTab): tab is LibraryId {
    return Object.values(LibraryId).includes(tab as LibraryId);
}

/**
 * Where a tab opens. A library is one of many under one route, so it is named
 * by its id; a utility is a page of its own, and its id is that page's path.
 */
export function getTabPath(tabId: AppTab): string {
    return isLibraryTab(tabId) ? `/app/library/${tabId}` : `/app/${tabId}`;
}

/**
 * A stored tab, or the default when it is not one the app still knows: the
 * column is plain text under its `$type`, so a row can name anything.
 */
export function toAppTab(tabId: string | undefined, fallback: AppTab): AppTab {
    return APP_TABS.includes(tabId as AppTab) ? (tabId as AppTab) : fallback;
}
