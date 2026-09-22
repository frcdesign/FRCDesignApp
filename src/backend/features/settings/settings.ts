import { AppTab } from "./app-tab";

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
    /** The tab they last opened, and land in next time; null until they pick
     * one, which is what the welcome asks for. */
    tabId: AppTab | null;
    /** The group they last opened in that tab; null for the tab itself. */
    groupId: string | null;
}

export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM,
    tabId: null,
    groupId: null
};
