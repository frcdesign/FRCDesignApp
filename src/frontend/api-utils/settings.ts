import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { Library, Theme } from "../../shared/types";
import { showErrorToast } from "../common/toaster";
import { apiPost } from "./api";

interface SaveSettingsOptions {
    /**
     * Where to navigate after applying the settings.
     * @default "." (stay on the current route)
     */
    to?: string;
}

/**
 * Returns a function that optimistically applies user settings (theme/library)
 * by writing them into the `settings` search param and persisting them to the
 * backend. Settings live in search params, so the navigation IS the optimistic
 * update; the functional updater keeps it correct across rapid changes.
 */
export function useSaveSettings() {
    const navigate = useNavigate();

    return useCallback(
        (
            newSettings: { theme?: Theme; library?: Library },
            opts?: SaveSettingsOptions
        ) => {
            void navigate({
                to: opts?.to ?? ".",
                search: (prev) => ({
                    ...prev,
                    settings: { ...prev.settings, ...newSettings }
                })
            });
            apiPost("/user-data", { body: newSettings }).catch(() => {
                showErrorToast("Unexpectedly failed to update settings.");
            });
        },
        [navigate]
    );
}
