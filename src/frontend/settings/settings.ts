import { useMutation } from "@tanstack/react-query";
import { type Settings } from "../../shared/types";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";
import { useUpdateContextData } from "../api-utils/refresh";
import { useIsSignedIn } from "../api-utils/sign-in";
import { writeLocalSettings } from "./local-settings";

export function useSaveSettings() {
    const updateContextData = useUpdateContextData();
    const isSignedIn = useIsSignedIn();

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: async (newSettings: Partial<Settings>) => {
            // Not signed in: no server-side user row; persist locally instead.
            if (!isSignedIn) {
                writeLocalSettings(newSettings);
                return;
            }
            return apiPost("/user-data", { body: newSettings });
        },
        onMutate: (newSettings) => {
            updateContextData((data) => {
                data.settings = { ...data.settings, ...newSettings };
            });
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
