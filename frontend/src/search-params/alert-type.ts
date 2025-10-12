import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * A list of alerts.
 */
export enum AlertType {
    CANNOT_DERIVE_ASSEMBLY = "cannot-derive-assembly",
    CANNOT_REORDER = "cannot-reorder",
    CANNOT_EDIT_DEFAULT_CONFIGURATION = "cannot-edit-default-configuration",
    RELOAD_DOCUMENTS = "reload-documents"
}

interface Empty {}

export type AlertParamsMap = {
    [AlertType.CANNOT_DERIVE_ASSEMBLY]: Empty;
    [AlertType.CANNOT_REORDER]: Empty;
    [AlertType.CANNOT_EDIT_DEFAULT_CONFIGURATION]: Empty;
    [AlertType.RELOAD_DOCUMENTS]: { reloadAll: boolean };
};

export type AlertParams = {
    [K in AlertType]: { activeAlert: K } & AlertParamsMap[K];
}[AlertType];

export function useOpenAlert() {
    const navigate = useNavigate();

    return useCallback(
        <T extends AlertType>(alert: T, props?: AlertParamsMap[T]) => {
            navigate({
                to: ".",
                search: { activeAlert: alert, ...props }
            });
        },
        [navigate]
    );
}
