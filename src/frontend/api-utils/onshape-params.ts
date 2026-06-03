import { ElementType } from "../../shared/types";
import { Theme } from "../../shared/types";
import { ElementPath } from "../../shared/onshape-path";

/**
 * Documents search parameter values received from Onshape.
 */
export interface OnshapeParams extends ElementPath {
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

/**
 * Returns the Mantine color scheme to force based on the resolved color theme.
 */
export function getColorScheme(colorTheme: ColorTheme): "light" | "dark" {
    return colorTheme;
}
