import { useMutation } from "@tanstack/react-query";
import { type SettingsUpdate } from "../../shared/types";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";
import { updateContextData } from "../api-utils/refresh";

export function useSaveSettings() {

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: (newSettings: SettingsUpdate) =>
            apiPost("/user-data", { body: newSettings }),
        onMutate: ({ theme }) => {
            // The library is write-behind — only the theme is rendered from here.
            if (theme === undefined) return;
            updateContextData((data) => {
                data.settings = { ...data.settings, theme };
            });
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
