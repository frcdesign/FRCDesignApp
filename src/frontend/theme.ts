import { createTheme, type MantineColorsTuple } from "@mantine/core";
import { Library } from "../shared/types";

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
 * Maps a library to its primary Mantine color. This is the single source of
 * truth for the per-library color scheme — add new libraries here.
 */
export function getLibraryColor(library: Library): string {
    switch (library) {
        case Library.FTC_DESIGN_LIB:
            return "orange";
        case Library.MKCAD:
            return "blue";
        case Library.FRC_DESIGN_LIB:
            return "frcGreen";
    }
}

/**
 * Builds the Mantine theme for the given library. The primary color follows the
 * library; danger/warning use Mantine's built-in `red`/`yellow`, so they remain
 * correct regardless of the primary color.
 */
export function createAppTheme(library: Library) {
    return createTheme({
        colors: { frcGreen },
        primaryColor: getLibraryColor(library),
        autoContrast: true
    });
}
