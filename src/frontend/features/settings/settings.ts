import { useMutation } from "@tanstack/react-query";
import type { SettingsUpdate } from "@backend/features/settings/settings";
import { showErrorToast } from "../../lib/notifications";
import { apiPost } from "../../lib/api-client";
import { getAccessDataQuery } from "../auth/access-level";
import { queryClient } from "../../lib/query-client";
import { writeLocalSettings } from "./local-settings";

async function saveSettings(newSettings: SettingsUpdate): Promise<void> {
    // Resolved here rather than read off a render: a placeholder that says
    // signed out would silently persist locally for a user who has a
    // server-side row.
    const { signedIn } =
        await queryClient.ensureQueryData(getAccessDataQuery());
    // Not signed in: no server-side user row; persist locally instead.
    if (!signedIn) {
        writeLocalSettings(newSettings);
        return;
    }
    await apiPost("/settings", { body: newSettings });
}

export function useSaveSettings() {
    const { mutate } = useMutation({
        mutationKey: ["settings"],
        mutationFn: saveSettings,
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}

/**
 * Records where the caller is, for the entry redirect to resume at. Called from
 * a route rather than a component, so it cannot be the mutation above.
 */
export function rememberOpenGroup(groupId: string | null): void {
    void saveSettings({ groupId }).catch(() => {
        // Resuming in the library instead of the group is not worth a toast.
    });
}
