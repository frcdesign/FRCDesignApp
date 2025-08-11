import { useLocation, useNavigate } from "@tanstack/react-router";
import { OnshapeData } from "./onshape-data";
import { useCallback } from "react";
import { AccessLevel, Vendor } from "./backend-types";

export enum AppMenu {
    INSERT_MENU = "insert-menu",
    SETTINGS_MENU = "settings-menu"
}

export interface InsertMenuParams {
    activeMenu: AppMenu.INSERT_MENU;
    // Cannot use elementId since that's already used by OnshapeData
    activeElementId: string;
}

export interface SettingsMenuParams {
    activeMenu: AppMenu.SETTINGS_MENU;
}

export type SearchParams = OnshapeData &
    BaseParams &
    (InsertMenuParams | SettingsMenuParams);

export interface BaseParams {
    /**
     * The maximum access level the user can have.
     */
    maxAccessLevel: AccessLevel;
    /**
     * The access level the user is currently using.
     */
    accessLevel: AccessLevel;
    activeMenu?: AppMenu;
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
                activeMenu: undefined
            }
        });
    }, [pathname, navigate]);
}
