import { useMutation } from "@tanstack/react-query";
import { LibraryId, Theme } from "../../shared/types";
import { showErrorToast } from "../common/notifications";
import { apiPost } from "../api-utils/api";
import { useUpdateContextData } from "../api-utils/refresh";

export function useSaveSettings() {
    const updateContextData = useUpdateContextData();

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: (newSettings: { theme?: Theme; libraryId?: LibraryId }) =>
            apiPost("/user-data", { body: newSettings }),
        onMutate: (newSettings) => {
            updateContextData(
                (data) => {
                    data.settings = { ...data.settings, ...newSettings };
                },
                // Only the theme is read from loader data; the library comes
                // from the url, and reloading mid-switch flashes the shell.
                { reload: newSettings.theme !== undefined }
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
