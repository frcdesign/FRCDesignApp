/**
 * What the navbar offers, and so what the app resumes into: one of the
 * libraries, or one of the app's own utilities. Onshape calls its elements
 * tabs as well — these are the app's own, which is what `App` says here.
 *
 * A leaf, so both sides can name a tab without reaching anything Worker-only.
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
 * A stored tab, or the default when it is not one the app still knows. The
 * column is plain text under its `$type`, so a row written before an id changed
 * — or by hand — reads back as something no route can render.
 */
export function toAppTab(tabId: string | undefined, fallback: AppTab): AppTab {
    return APP_TABS.includes(tabId as AppTab) ? (tabId as AppTab) : fallback;
}
