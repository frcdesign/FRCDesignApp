import { useLocation, useNavigate } from "@tanstack/react-router";
import { OnshapeData } from "./onshape-data";
import { useCallback } from "react";
import { Vendor } from "./backend-types";

export enum AppDialog {
    INSERT_MENU = "insert-menu",
    ADMIN_PANEL = "admin-panel"
}

export interface InsertMenuParams {
    activeDialog: AppDialog.INSERT_MENU;
    // Cannot use elementId since that's already used by OnshapeData
    activeElementId: string;
}

export interface AdminPanelParams {
    activeDialog: AppDialog.ADMIN_PANEL;
}

export type SearchParams = OnshapeData &
    BaseParams &
    (InsertMenuParams | AdminPanelParams);

export interface BaseParams {
    activeDialog?: AppDialog;
    query?: string;
    vendors?: Vendor[];
}

/**
 * A hook that returns a function that can be invoked to close the current dialog.
 */
export function useHandleCloseDialog() {
    const navigate = useNavigate();
    const pathname = useLocation().pathname;
    return useCallback(() => {
        navigate({
            to: pathname,
            search: {
                activeDialog: undefined
            }
        });
    }, [pathname, navigate]);
}
