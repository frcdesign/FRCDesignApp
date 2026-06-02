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

export interface PopupParamsMap {
    [AppPopup.CANNOT_DERIVE_ASSEMBLY]: void;
    [AppPopup.CANNOT_REORDER]: void;
    [AppPopup.CANNOT_EDIT_DEFAULT_CONFIGURATION]: void;
    [AppPopup.RELOAD_DOCUMENTS]: { reloadAll: boolean };
}

export type PopupParams = {
    [K in AppPopup]: { activePopup: K } & PopupParamsMap[K];
}[AppPopup];

export function useOpenPopup() {
    const navigate = useNavigate();

    return useCallback(
        <T extends AppPopup>(popup: T, props?: PopupParamsMap[T]) => {
            void navigate({
                to: ".",
                search: { activePopup: popup, ...props }
            });
        },
        [navigate]
    );
}
