import { LibraryId } from "../library/library-id";

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
    /** The library the caller last opened, and lands in next time. */
    libraryId: LibraryId;
    /** The group they last opened in it; null for the library itself. */
    groupId: string | null;
    /**
     * Whether the version manager was the page last open, which entry resumes
     * in ahead of the library — where the panel has a workspace for it to act
     * on, and so has the page at all.
     */
    isVersionManagerOpen: boolean;
}

export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    libraryId: LibraryId.FRC_DESIGN_LIB,
    groupId: null,
    isVersionManagerOpen: false
};
