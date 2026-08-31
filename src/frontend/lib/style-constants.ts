/**
 * Sizes for Phosphor icons. The first three are general magnitudes for an icon
 * in a line of content; the rest each name the one place they are used.
 */
export enum IconSize {
    /** Beside xs text: badge labels and metadata rows. */
    TINY = 12,
    /** The default, beside a label in a button or menu option. */
    SMALL = 16,
    /** Standalone in a row, and the icon of a toast. */
    MEDIUM = 18,
    /** Icon-only controls, at input height next to full-height buttons. */
    CONTROL = 24,
    /** Section-level empty and error states. */
    SECTION = 36,
    /** Full-page error states. */
    PAGE = 48
}

/** Standard Mantine font weights. */
export enum FontWeight {
    SEMI_BOLD = 500,
    BOLD = 700
}

export const BORDER = "1px solid var(--mantine-color-default-border)";

/** The corner every box of ours is cut with, matching the theme's default. */
export const RADIUS = "var(--mantine-radius-sm)";

/**
 * The colors state is spoken in, as Mantine names them. Named here rather than
 * written at each control, so an error looks like an error everywhere.
 */
export enum StatusColor {
    ERROR = "red",
    WARNING = "yellow",
    INFO = "blue",
    SUCCESS = "green",
    /** A control that should not compete with the library's accent. */
    NEUTRAL = "gray",
    /** Secondary text: the metadata beside a name. */
    DIMMED = "dimmed"
}

/** The same color as a tint to sit content on, e.g. a callout's background. */
export function statusBackground(color: StatusColor): string {
    return `var(--mantine-color-${color}-light)`;
}

/** A step off the page, for the bars framing it: the navbar's tab row, a
 * modal's header and footer. */
export const FRAME_BACKGROUND =
    "light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-8))";

/**
 * Text reads as centred on its cap height, a pixel above its line box, so an
 * icon centred on that box looks low. `text-box` clips descenders under truncation.
 */
export const TITLE_ICON_NUDGE = { transform: "translateY(-1px)" };

/**
 * One height for a section header, set rather than left to the content: an
 * accordion is sized by its label, a group header by its menu button.
 */
export const SECTION_HEADER_HEIGHT = 48;

/** The app's primary color as a filled background. */
export enum PrimaryColor {
    /** The current library's color, e.g. green for FRCDesign. */
    FILLED = "var(--mantine-primary-color-filled)",
    /** What reads on top of it, typically white. */
    CONTRAST = "var(--mantine-primary-color-contrast)"
}
