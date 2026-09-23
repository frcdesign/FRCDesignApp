import {
    Card,
    createTheme,
    HoverCard,
    type MantineColorsTuple,
    Tooltip
} from "@mantine/core";
import { LibraryId } from "@backend/features/library/library-id";
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
 * names a library that does not exist — which the route 404s separately — or
 * a tab that is not a library, which has no library color of its own.
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

/** A library's color as Mantine's `color.shade`, for a chart series, a tile,
 * or text that should read as the library. */
export function getLibraryShade(libraryId: string): string {
    return `${getLibraryColor(libraryId)}.${FILLED_SHADE}`;
}

/** The frame stays neutral; a library's color is an accent on its controls. */
export function createAppTheme(libraryId: string) {
    return createTheme({
        colors: { frcGreen },
        primaryColor: getLibraryColor(libraryId),
        autoContrast: true,
        // Mantine's "md" default reads soft for a dense CAD panel.
        defaultRadius: "sm",
        cursorType: "pointer",
        // Drops the class carrying Mantine's 1px press-down translate, which
        // nudged every button and icon button down on click.
        activeClassName: "",
        // How every one of these is drawn here, so a call site names only
        // what makes it different.
        components: {
            Tooltip: Tooltip.extend({
                defaultProps: { withArrow: true, multiline: true, maw: 260 }
            }),
            HoverCard: HoverCard.extend({
                defaultProps: {
                    withinPortal: true,
                    shadow: "md",
                    withArrow: true
                }
            }),
            Card: Card.extend({
                defaultProps: { withBorder: true, padding: "lg", radius: "md" }
            })
        }
    });
}
