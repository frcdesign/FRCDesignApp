import { useMutation } from "@tanstack/react-query";
import type { SettingsUpdate } from "@backend/features/settings/settings";
import { showErrorToast } from "../../lib/notifications";
import { apiPost } from "../../lib/api-client";
import { getAccessDataQuery } from "../auth/access-level";
import { queryClient } from "../../lib/query-client";
import { writeLocalSettings } from "./local-settings";

export function useSaveSettings() {
    const { mutate } = useMutation({
        mutationKey: ["settings"],
        mutationFn: async (newSettings: SettingsUpdate) => {
            // Resolved here rather than read off a render: a placeholder that
            // says signed out would silently persist locally for a user who
            // has a server-side row.
            const { signedIn } =
                await queryClient.ensureQueryData(getAccessDataQuery());
            // Not signed in: no server-side user row; persist locally instead.
            if (!signedIn) {
                writeLocalSettings(newSettings);
                return;
            }
            return apiPost("/settings", { body: newSettings });
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
