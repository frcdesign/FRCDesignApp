import { LibraryId } from "../library/library-id";

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
}

export interface SettingsUpdate {
    theme?: Theme;
    libraryId?: LibraryId;
}

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM
};
