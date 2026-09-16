import type { SettingsUpdate } from "@backend/features/settings/settings";
import { showErrorToast } from "../../lib/notifications";
import { apiPost } from "../../lib/api-client";
import { getAccessDataQuery } from "../auth/access-level";
import { queryClient } from "../../lib/query-client";
import { setSettingsSync } from "../../lib/ui-state";

/** Writes the caller's row, which the entry redirect starts their next browser from. */
async function postSettings(newSettings: SettingsUpdate): Promise<void> {
    // Resolved here rather than read off a render: a placeholder that says
    // signed out would skip the save for a user who has a server-side row.
    const { signedIn } =
        await queryClient.ensureQueryData(getAccessDataQuery());
    if (!signedIn) {
        return;
    }
    await apiPost("/settings", { body: newSettings });
}

/**
 * Hands the store somewhere to put a synced field, so writing one is an
 * ordinary `updateUiState` from wherever it is set — a menu, or a route that
 * cannot hold a hook.
 */
export function installSettingsSync(): void {
    setSettingsSync((settings) => {
        void postSettings(settings).catch(() => {
            showErrorToast("Unexpectedly failed to update settings.");
        });
    });
}
