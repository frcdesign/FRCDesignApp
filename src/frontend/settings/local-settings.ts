import { type SettingsUpdate } from "../../shared/types";

const SETTINGS_STORAGE_KEY = "frc-design-app-settings";

/** Reads locally-persisted settings, used when not signed in. */
export function readLocalSettings(): SettingsUpdate {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as SettingsUpdate) : {};
    } catch {
        return {};
    }
}

/** Merges and persists settings locally, used when not signed in. */
export function writeLocalSettings(newSettings: SettingsUpdate): void {
    try {
        const merged = { ...readLocalSettings(), ...newSettings };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
        // Ignore storage failures (e.g. private browsing).
    }
}
