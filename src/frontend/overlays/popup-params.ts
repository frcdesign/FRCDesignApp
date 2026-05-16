import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * A list of alerts.
 */
export enum AppPopup {
    CANNOT_DERIVE_ASSEMBLY = "cannot-derive-assembly",
    CANNOT_REORDER = "cannot-reorder",
    CANNOT_EDIT_DEFAULT_CONFIGURATION = "cannot-edit-default-configuration",
    RELOAD_DOCUMENTS = "reload-documents"
}

export type PopupParamsMap = {
    [AppPopup.CANNOT_DERIVE_ASSEMBLY]: never;
    [AppPopup.CANNOT_REORDER]: never;
    [AppPopup.CANNOT_EDIT_DEFAULT_CONFIGURATION]: never;
    [AppPopup.RELOAD_DOCUMENTS]: { reloadAll: boolean };
};

export type AlertParams = {
    [K in AppPopup]: { activeAlert: K } & PopupParamsMap[K];
}[AppPopup];

export function useOpenAlert() {
    const navigate = useNavigate();

    return useCallback(
        <T extends AppPopup>(alert: T, props?: PopupParamsMap[T]) => {
            navigate({
                to: ".",
                search: { activeAlert: alert, ...props }
            });
        },
        [navigate]
    );
}
