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
    /** The caller's saved theme, seeded by the entry redirect. */
    theme: Theme;
    server: string;
    /** Set on the sign-in redirect so the app confirms success once. */
    justSignedIn?: string;
}

/**
 * An actual color theme, as provided by Onshape.
 *
 * See also Theme, which is a superset of ColorTheme that also includes "system".
 */
export type ColorTheme = "light" | "dark";

/**
 * Resolves the theme to an actual color scheme. `systemTheme` is Onshape's,
 * forwarded by the entry redirect; standalone there is none, so the caller
 * passes the OS preference instead.
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
