import {
    ActionIcon,
    Badge,
    Button,
    Card,
    createTheme,
    Group,
    HoverCard,
    Input,
    type MantineColorsTuple,
    Menu,
    Modal,
    Popover,
    rem,
    Table,
    Text,
    Tooltip
} from "@mantine/core";
import { useIsDashboard } from "./features/dashboard/dashboard-nav";
import { LibraryId } from "@backend/features/library/library-id";
import { useIsVersionManager } from "./features/version-manager/navigation";
import { FILLED_SHADE, IconSize, StatusColor } from "./lib/style-constants";

/** Index 6 is the brand color; https://mantine.dev/colors-generator to tune. */
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

/** Falls back for unknown libraries and non-library tabs. */
export function getLibraryColor(libraryId: string): string {
    switch (libraryId) {
        case LibraryId.CONFIG_LIB:
            return "orange";
        case LibraryId.MKCAD:
            return "blue";
        default:
            return "frcGreen";
    }
}

/** A color's filled shade, which is what reads as that color beside text. */
export function toShade(color: string): string {
    return `${color}.${FILLED_SHADE}`;
}

export function getLibraryShade(libraryId: string): string {
    return toShade(getLibraryColor(libraryId));
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
    const isDashboard = useIsDashboard();
    const isVersionManager = useIsVersionManager();

    if (isDashboard) {
        return AppColor.DASHBOARD;
    }
    if (isVersionManager) {
        return AppColor.VERSION_MANAGER;
    }
    return getLibraryColor(libraryId);
}

// Phosphor icons default to 1em, so an icon in a section takes this size unless it sets its own.
const ICON_SECTION = { fontSize: rem(IconSize.SMALL) };

const FLOATING = {
    shadow: "md",
    withArrow: true,
    // So a card beside a row on a phone is pushed on screen, not cut off.
    middlewares: { flip: true, shift: { crossAxis: true, padding: 8 } }
};

/** The frame stays neutral; the page's color is an accent on its controls. */
export function createAppTheme(primaryColor: string) {
    return createTheme({
        colors: { frcGreen },
        primaryColor,
        autoContrast: true,
        // Mantine's "md" default reads soft for a dense CAD panel.
        defaultRadius: "sm",
        cursorType: "pointer",
        // Drops Mantine's 1px press-down nudge.
        activeClassName: "",
        components: {
            Tooltip: Tooltip.extend({
                defaultProps: {
                    withArrow: true,
                    multiline: true,
                    maw: 260,
                    // Touch is off by default, leaving touchscreens no way to read one.
                    events: { hover: true, focus: true, touch: true }
                }
            }),
            Card: Card.extend({
                defaultProps: { withBorder: true, padding: "lg", radius: "md" }
            }),
            Text: Text.extend({ defaultProps: { size: "sm" } }),
            Group: Group.extend({ defaultProps: { wrap: "nowrap" } }),
            Button: Button.extend({
                defaultProps: { variant: "light" },
                styles: { section: ICON_SECTION }
            }),
            ActionIcon: ActionIcon.extend({
                defaultProps: { variant: "subtle", color: StatusColor.NEUTRAL }
            }),
            Badge: Badge.extend({
                defaultProps: { variant: "light", size: "sm" }
            }),
            Menu: Menu.extend({
                defaultProps: { shadow: "md" },
                styles: { itemSection: ICON_SECTION }
            }),
            Popover: Popover.extend({ defaultProps: FLOATING }),
            HoverCard: HoverCard.extend({
                // Tapping is off by default, as a Tooltip's touch is.
                defaultProps: {
                    ...FLOATING,
                    events: { hover: true, focus: true, touch: true }
                }
            }),
            Input: Input.extend({ styles: { section: ICON_SECTION } }),
            Modal: Modal.extend({ defaultProps: { centered: true } }),
            Table: Table.extend({ defaultProps: { highlightOnHover: true } })
        }
    });
}
