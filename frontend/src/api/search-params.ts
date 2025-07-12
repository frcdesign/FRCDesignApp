import { ElementType } from "./backend-types";
import { ElementPath } from "./path";

export enum ColorTheme {
    LIGHT = "light",
    DARK = "dark"
}

/**
 * @param id : The Onshape id of the current user.
 */
export interface SearchParams extends ElementPath {
    elementType: ElementType;
    theme: ColorTheme;
    clientId: string;
    id: string;
}

export function getThemeClass(theme: ColorTheme) {
    return theme === ColorTheme.DARK ? "bp6-dark" : "";
}
