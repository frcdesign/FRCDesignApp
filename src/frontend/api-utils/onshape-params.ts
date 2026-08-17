import { useSearch } from "@tanstack/react-router";
import { ElementType } from "../../shared/types";
import { Theme } from "../../shared/types";
import { ElementPath } from "../../shared/onshape-path";

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
}

/**
 * An actual color theme, as provided by Onshape.
 *
 * See also Theme, which is a superset of ColorTheme that also includes "system".
 */
export type ColorTheme = "light" | "dark";

export function getColorTheme(
    theme: Theme,
    systemTheme: ColorTheme = "light"
): ColorTheme {
    if (theme === Theme.SYSTEM) {
        return systemTheme;
    }
    return theme;
}

/**
 * Whether the app is embedded in an Onshape document, i.e. the url carries a
 * full element path. A signed-in caller opening the app directly is not.
 */
export function useIsConnectedToOnshape(): boolean {
    const search = useSearch({ strict: false });
    return Boolean(search.documentId && search.instanceId && search.elementId);
}
