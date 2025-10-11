import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { Configuration } from "./models";

export enum AppMenu {
    INSERT_MENU = "insert-menu",
    SETTINGS_MENU = "settings-menu",
    ADD_DOCUMENT_MENU = "add-document-menu",
    FAVORITE_MENU = "favorite-menu"
}

/**
 * Converts MenuParams into a type suitable for passing as Props for the MenuDialog component.
 */
export type MenuDialogProps<T extends MenuParams> = Omit<T, "activeMenu">;

export interface InsertMenuParams {
    activeMenu: AppMenu.INSERT_MENU;
    // Cannot use elementId since that's already used by OnshapeData
    activeElementId: string;
    defaultConfiguration?: Configuration;
}

export interface AddDocumentMenuParams {
    activeMenu: AppMenu.ADD_DOCUMENT_MENU;
    selectedDocumentId?: string;
}

export interface SettingsMenuParams {
    activeMenu: AppMenu.SETTINGS_MENU;
}

export interface FavoriteMenuParams {
    activeMenu: AppMenu.FAVORITE_MENU;
    favoriteId: string;
    defaultConfiguration?: Configuration;
}

export type MenuParams =
    | InsertMenuParams
    | AddDocumentMenuParams
    | SettingsMenuParams
    | FavoriteMenuParams;

/**
 * A hook that returns a function that can be invoked to close the current dialog.
 */
export function useHandleCloseDialog() {
    const navigate = useNavigate();

    return useCallback(() => {
        navigate({
            to: ".",
            search: {
                activeMenu: undefined,
                activeElementId: undefined,
                selectedDocumentId: undefined
            }
        });
    }, [navigate]);
}
