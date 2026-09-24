import { AppTab } from "./app-tab";

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
    /** Null until picked, which the welcome asks for. */
    tabId: AppTab | null;
    /** The group they last opened in that tab; null for the tab itself. */
    groupId: string | null;
}

/** Absent leaves a setting as it is; null clears the tab or group. */
export type SettingsUpdate = Partial<Settings>;

export const DEFAULT_THEME = Theme.SYSTEM;
