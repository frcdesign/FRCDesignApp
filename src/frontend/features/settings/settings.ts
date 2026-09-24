import type { SettingsUpdate } from "@backend/features/settings/settings";
import { showErrorToast } from "../../lib/notifications";
import { apiPost } from "../../lib/api-client";
import { getAccessDataQuery } from "../auth/access-level";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { queryClient } from "../../lib/query-client";
import { setSettingsSync } from "../../lib/ui-state";

/** Writes the caller's row, which the entry redirect starts their next browser from. */
async function postSettings(newSettings: SettingsUpdate): Promise<void> {
    // Resolved rather than read from a render, whose placeholder says signed out.
    const { signedIn } = await queryClient.ensureQueryData(
        getAccessDataQuery(DEFAULT_LIBRARY)
    );
    if (!signedIn) {
        return;
    }
    await apiPost("/settings", { body: newSettings });
}

/** Lets any `updateUiState` call sync a field, including from routes that can't use hooks. */
export function installSettingsSync(): void {
    setSettingsSync((settings) => {
        void postSettings(settings).catch(() => {
            showErrorToast("Unexpectedly failed to update settings.");
        });
    });
}
