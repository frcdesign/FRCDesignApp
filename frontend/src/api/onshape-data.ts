import { Store, useStore } from "@tanstack/react-store";
import { ElementType } from "./backend-types";
import { UserPath, ElementPath } from "./path";

export enum ColorTheme {
    LIGHT = "light",
    DARK = "dark"
}

/**
 * @param id : The Onshape id of the current user.
 */
export interface OnshapeData extends ElementPath, UserPath {
    elementType: ElementType;
    theme: ColorTheme;
}

export function getThemeClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK ? "bp6-dark" : "";
}

// Parameters should be saved on initial load, so fine to assert the store will always contain OnshapeData
export const onshapeDataStore = new Store<OnshapeData>(
    null as unknown as OnshapeData
);

export function saveOnshapeData(search: Record<string, unknown>) {
    onshapeDataStore.setState(() => search as unknown as OnshapeData);
}

export function useOnshapeData(): OnshapeData {
    return useStore(onshapeDataStore);
}
