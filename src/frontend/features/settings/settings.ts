import { useMutation } from "@tanstack/react-query";
import type { SettingsUpdate } from "../../../backend/features/users/settings";
import { showErrorToast } from "../../lib/notifications";
import { apiPost } from "../../lib/api-client";
import { useIsSignedIn } from "../auth/access-level";
import { writeLocalSettings } from "./local-settings";

export function useSaveSettings() {
    const isSignedIn = useIsSignedIn();

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: async (newSettings: SettingsUpdate) => {
            // Not signed in: no server-side user row; persist locally instead.
            if (!isSignedIn) {
                writeLocalSettings(newSettings);
                return;
            }
            return apiPost("/user-data", { body: newSettings });
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
