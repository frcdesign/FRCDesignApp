import { useMutation } from "@tanstack/react-query";
import type { SettingsUpdate } from "../../shared/settings";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";
import { useIsSignedIn } from "../api-utils/access-level";
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
