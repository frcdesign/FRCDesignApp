import { type LibraryId } from "@backend/features/library/library-id";
import {
    DEFAULT_SETTINGS,
    type SettingsUpdate,
    type Theme
} from "@backend/features/settings/settings";

const SETTINGS_STORAGE_KEY = "frc-design-app-settings";

function readStored(): SettingsUpdate {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as SettingsUpdate) : {};
    } catch {
        return {};
    }
}

/** Locally-persisted settings (used when not signed in), with defaults filled. */
export function readLocalSettings(): { theme: Theme; libraryId: LibraryId } {
    const stored = readStored();
    return {
        theme: stored.theme ?? DEFAULT_SETTINGS.theme,
        libraryId: stored.libraryId ?? DEFAULT_SETTINGS.libraryId
    };
}

/** Merges and persists settings locally, used when not signed in. */
export function writeLocalSettings(newSettings: SettingsUpdate): void {
    try {
        const merged = { ...readStored(), ...newSettings };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
        // Ignore storage failures (e.g. private browsing).
    }
}
