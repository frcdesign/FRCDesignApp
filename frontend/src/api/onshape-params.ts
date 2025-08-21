import { ElementType } from "./backend-types";
import { UserPath, ElementPath } from "./path";
import { Classes } from "@blueprintjs/core";

/**
 * Documents search parameter values received from Onshape.
 */
export interface OnshapeParams extends ElementPath, UserPath {
    elementType: ElementType;
    theme: ColorTheme;
}

export enum ColorTheme {
    LIGHT = "light",
    DARK = "dark"
}

export function getThemeClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK ? Classes.DARK : "";
}

export function getBackgroundClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK
        ? "app-dark-background"
        : "app-light-background";
}
