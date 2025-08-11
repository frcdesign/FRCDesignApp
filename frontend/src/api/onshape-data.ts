import { useSearch } from "@tanstack/react-router";
import { ElementType } from "./backend-types";
import { UserPath, ElementPath } from "./path";
import { Classes } from "@blueprintjs/core";

export interface OnshapeData extends ElementPath, UserPath {
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

export function useOnshapeData(): OnshapeData {
    return useSearch({ from: "/app" });
}
