import { createTheme, type MantineColorsTuple } from "@mantine/core";
import { LibraryId } from "@backend/features/library/library-id";

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
 * Maps a library to its primary Mantine color.
 */
export function getLibraryColor(libraryId: LibraryId): string {
    switch (libraryId) {
        case LibraryId.FTC_DESIGN_LIB:
            return "orange";
        case LibraryId.MKCAD:
            return "blue";
        case LibraryId.FRC_DESIGN_LIB:
            return "frcGreen";
    }
}

export function createAppTheme(libraryId: LibraryId) {
    return createTheme({
        colors: { frcGreen },
        primaryColor: getLibraryColor(libraryId),
        autoContrast: true,
        cursorType: "pointer"
    });
}
