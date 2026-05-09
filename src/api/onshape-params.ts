import { ElementType, Theme } from "./models";
import { UserPath, ElementPath } from "./path";
import { Classes } from "@blueprintjs/core";

/**
 * Documents search parameter values received from Onshape.
 */
export interface OnshapeParams extends ElementPath, UserPath {
    elementType: ElementType;
    systemTheme: ColorTheme;
    server: string;
}

export type ColorTheme = "light" | "dark";

export function getColorTheme(
    theme: Theme,
    systemTheme: ColorTheme
): ColorTheme {
    if (theme === Theme.SYSTEM) {
        return systemTheme;
    }
    return theme;
}

export function getThemeClass(colorTheme: ColorTheme) {
    return colorTheme === "dark" ? Classes.DARK : "";
}

export function getBackgroundClass(colorTheme: ColorTheme) {
    return colorTheme === "dark"
        ? "app-dark-background"
        : "app-light-background";
}
