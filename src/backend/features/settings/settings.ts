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
     * Whether they have answered the program prompt the app opens with. False
     * until they pick one, which is what makes the library above their choice
     * rather than the default they were given.
     */
    libraryChosen: boolean;
}

export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    libraryId: LibraryId.FRC_DESIGN_LIB,
    groupId: null,
    libraryChosen: false
};
