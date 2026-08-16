import { useMutation } from "@tanstack/react-query";
import { type SettingsUpdate } from "../../shared/types";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";

export function useSaveSettings() {
    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: (newSettings: SettingsUpdate) =>
            apiPost("/user-data", { body: newSettings }),
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
