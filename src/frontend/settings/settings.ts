import { useMutation } from "@tanstack/react-query";
import { Theme } from "../../shared/types";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";
import { useUpdateContextData } from "../api-utils/refresh";

export function useSaveSettings() {
    const updateContextData = useUpdateContextData();

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: (newSettings: { theme?: Theme }) =>
            apiPost("/user-data", { body: newSettings }),
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
