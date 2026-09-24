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

/** For a badge naming a kind; not a status color, and not gray, which reads as disabled. */
export const CATEGORY_COLOR = "violet";

/** Mantine's default shade. */
export const FILLED_SHADE = 6;

/** For props that take a CSS value. */
export function colorVar(color: string, shade: number): string {
    return `var(--mantine-color-${color}-${shade})`;
}

/** Secondary but legible in both themes, which bare "gray" isn't. */
export const MUTED_MARK = `${StatusColor.NEUTRAL}.5`;

/** Onshape renders parts light on white, so light mode needs a darker card. */
export const RENDER_BACKGROUND =
    "light-dark(var(--mantine-color-gray-1), var(--mantine-color-body))";

/** Matches a subtle gray control's icon, for a bare icon beside one. */
export const CONTROL_ICON_COLOR = "var(--mantine-color-gray-light-color)";

/** Paints an image in the text color. Quoted since data uris can hold apostrophes. */
export function maskedImage(url: string) {
    return {
        backgroundColor: "currentColor",
        maskImage: `url("${url}")`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center"
    };
}

/** The height of a default-sized Mantine input, for aligning beside one. */
export const INPUT_HEIGHT = "36px";

export const NAVBAR_ROW_HEIGHT = 48;

/** Stands out against the navbar's frame in either theme. */
export const NAVBAR_DIVIDER_COLOR =
    "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))";

/** The app's primary color as a filled background. */
export enum PrimaryColor {
    /** The current library's color, e.g. green for FRCDesign. */
    FILLED = "var(--mantine-primary-color-filled)",
    /** What reads on top of it, typically white. */
    CONTRAST = "var(--mantine-primary-color-contrast)"
}
