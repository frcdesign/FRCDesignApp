/** "App" tab, since Onshape calls its elements tabs too. */
import { LibraryId } from "@backend/features/library/library-id";

/** A tab that is not a library, having a page of the app's own instead. */
export enum UtilityTab {
    VERSION_MANAGER = "version-manager"
}

export type AppTab = LibraryId | UtilityTab;

export function isLibraryTab(tab: AppTab): tab is LibraryId {
    return Object.values(LibraryId).includes(tab as LibraryId);
}

export function getTabPath(tabId: AppTab): string {
    return isLibraryTab(tabId) ? `/app/library/${tabId}` : `/app/${tabId}`;
}
