import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Library, Theme, type ContextData } from "../../shared/types";
import { showErrorToast } from "../common/toaster";
import { apiPost } from "./api";
import { queryClient } from "../query-client";
import { contextDataQueryKey } from "../queries";
import { getQueryUpdater } from "../common/utils";

export function useSaveSettings() {
    const router = useRouter();

    const { mutate } = useMutation({
        mutationKey: ["user-data"],
        mutationFn: (newSettings: { theme?: Theme; library?: Library }) =>
            apiPost("/user-data", { body: newSettings }),
        onMutate: (newSettings) => {
            queryClient.setQueryData(
                contextDataQueryKey(),
                getQueryUpdater((data: ContextData) => {
                    data.settings = { ...data.settings, ...newSettings };
                    return data;
                })
            );
            void router.invalidate();
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
        }
    });

    return mutate;
}
