/** "App" tab, since Onshape calls its elements tabs too. */
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

export function getTabPath(tabId: AppTab): string {
    return isLibraryTab(tabId) ? `/app/library/${tabId}` : `/app/${tabId}`;
}

/** The column is plain text, so a row can name anything. */
export function toAppTab(tabId: string | undefined, fallback: AppTab): AppTab {
    return APP_TABS.includes(tabId as AppTab) ? (tabId as AppTab) : fallback;
}
