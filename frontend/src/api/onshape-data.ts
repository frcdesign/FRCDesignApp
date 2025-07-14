import { useSearch } from "@tanstack/react-router";
import { ElementType } from "./backend-types";
import { UserPath, ElementPath } from "./path";

export interface OnshapeData extends ElementPath, UserPath {
    elementType: ElementType;
    theme: ColorTheme;
}

export enum ColorTheme {
    LIGHT = "light",
    DARK = "dark"
}

export function getThemeClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK ? "bp6-dark" : "";
}

export function useOnshapeData(): OnshapeData {
    return useSearch({ from: "/app" });
}
