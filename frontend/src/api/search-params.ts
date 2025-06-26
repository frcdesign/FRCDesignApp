import { ElementType } from "./backend-types";
import { ElementPath } from "./path";

export enum ColorTheme {
    LIGHT = "light",
    DARK = "dark"
}

export interface SearchParams extends ElementPath {
    elementType: ElementType;
    theme: ColorTheme;
}

export function getThemeClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK ? "bp5-dark" : "";
}
