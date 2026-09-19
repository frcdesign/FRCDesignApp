import { createTheme, type MantineColorsTuple } from "@mantine/core";
import { useMatch } from "@tanstack/react-router";
import { LibraryId } from "@backend/features/library/library-id";
import { useIsVersionManager } from "./features/version-manager/navigation";
import { FILLED_SHADE } from "./lib/style-constants";

/**
 * FRCDesign brand green ramp (index 6 = #4cae4f, the brand color).
 * Generate replacements with https://mantine.dev/colors-generator if tuning.
 */
const frcGreen: MantineColorsTuple = [
    "#eef9ee",
    "#dcf1dc",
    "#b6e3b6",
    "#8dd48d",
    "#6bc86b",
    "#56c156",
    "#4cae4f",
    "#3f9942",
    "#318235",
    "#236b28"
];

/**
 * Falls back rather than throwing: the root themes the app even when the url
 * names a library that does not exist, which the route 404s separately.
 */
export function getLibraryColor(libraryId: string): string {
    switch (libraryId) {
        case LibraryId.FTC_DESIGN_LIB:
            return "orange";
        case LibraryId.MKCAD:
            return "blue";
        default:
            return "frcGreen";
    }
}

/**
 * The colors of the pages that are not a library's. Each says which part of the
 * app is showing, the way a library's color says which library is.
 */
export enum AppColor {
    /** FRCDesign's own, whichever library the dashboard is reporting on. */
    DASHBOARD = "frcGreen",
    /** The version manager acts on the open document, which is no library's. */
    VERSION_MANAGER = "blue"
}

/**
 * What the app is themed in right now: the page's own color where it has one,
 * and the library's otherwise.
 */
export function useAppColor(libraryId: string): string {
    const isDashboard =
        useMatch({ from: "/dashboard", shouldThrow: false }) !== undefined;
    const isVersionManager = useIsVersionManager();

    if (isDashboard) {
        return AppColor.DASHBOARD;
    }
    if (isVersionManager) {
        return AppColor.VERSION_MANAGER;
    }
    return getLibraryColor(libraryId);
}

/** A library's color as Mantine's `color.shade`, for a chart series or tile. */
export function getLibraryShade(libraryId: string): string {
    return `${getLibraryColor(libraryId)}.${FILLED_SHADE}`;
}

/** The frame stays neutral; the page's color is an accent on its controls. */
export function createAppTheme(primaryColor: string) {
    return createTheme({
        colors: { frcGreen },
        primaryColor,
        autoContrast: true,
        // Mantine's "md" default reads soft for a dense CAD panel.
        defaultRadius: "sm",
        cursorType: "pointer",
        // Drops the class carrying Mantine's 1px press-down translate, which
        // nudged every button and icon button down on click.
        activeClassName: ""
    });
}
