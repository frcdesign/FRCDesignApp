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
}

export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    libraryId: LibraryId.FRC_DESIGN_LIB
};
