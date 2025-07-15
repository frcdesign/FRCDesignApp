import { useLocation, useNavigate } from "@tanstack/react-router";
import { OnshapeData } from "./onshape-data";
import { useCallback } from "react";

export enum AppDialog {
    INSERT_MENU = "insert-menu",
    ADMIN_PANEL = "admin-panel"
}

export interface InsertMenuSearch {
    activeDialog: AppDialog.INSERT_MENU;
    // Cannot use elementId since that's already used by OnshapeData
    activeElementId: string;
}

export interface AdminPanelSearch {
    activeDialog: AppDialog.ADMIN_PANEL;
}

export type AppSearch = OnshapeData &
    BaseSearch &
    (InsertMenuSearch | AdminPanelSearch);

export interface BaseSearch {
    activeDialog?: AppDialog;
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
            search: (prev) => {
                return {
                    ...prev,
                    activeDialog: undefined
                };
            }
        });
    }, [pathname, navigate]);
}
