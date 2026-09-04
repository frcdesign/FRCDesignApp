import { useSearch } from "@tanstack/react-router";
import { ElementType } from "@backend/lib/onshape/element-type";
import { Theme } from "@backend/features/settings/settings";
import { ElementPath, isElementPath } from "@backend/lib/onshape/path";

/**
 * Documents search parameter values received from Onshape.
 */
export interface OnshapeParams extends ElementPath {
    elementType: ElementType;
    /** The color scheme Onshape is using, forwarded by the entry redirect. */
    systemTheme: ColorTheme;
    /** The account's saved theme, seeded by the entry redirect and then taken
     * into ui-state, which is where the app reads it from. */
    theme?: Theme;
    server: string;
}

/** A resolved theme, as Onshape provides it; Theme adds "system" on top. */
export type ColorTheme = "light" | "dark";

/**
 * `systemTheme` is Onshape's, forwarded by the entry redirect; standalone there
 * is none, so the caller passes the OS preference instead.
 */
export function getColorTheme(
    theme: Theme,
    systemTheme: ColorTheme
): ColorTheme {
    return theme === Theme.SYSTEM ? systemTheme : theme;
}

/**
 * Whether the app is embedded in an Onshape document, i.e. the url carries a
 * full element path. A signed-in caller opening the app directly is not.
 */
export function useIsConnectedToOnshape(): boolean {
    return isElementPath(useSearch({ strict: false }));
}
