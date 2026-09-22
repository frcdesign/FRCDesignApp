import { DEFAULT_LIBRARY } from "../library/library-id";
import { AppTab } from "./app-tab";

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
    /** The tab the caller last opened, and lands in next time. */
    tabId: AppTab;
    /** The group they last opened in it, when it is a library; null for the
     * library itself, and for a tab that has no groups. */
    groupId: string | null;
    /**
     * Whether they have answered the program prompt the app opens with. False
     * until they pick one, which is what makes the tab above their choice
     * rather than the default they were given.
     */
    libraryChosen: boolean;
}

export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    tabId: DEFAULT_LIBRARY,
    groupId: null,
    libraryChosen: false
};
