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

/**
 * A badge naming a kind rather than a state — a configuration parameter's type,
 * say. Off every {@link StatusColor} so it never reads as one, and never gray,
 * which on a badge reads as disabled rather than as a label.
 */
export const CATEGORY_COLOR = "violet";

/**
 * Mantine's default step for a color: what a bare color name renders as, and
 * so the step anything picking its own color should match.
 */
export const FILLED_SHADE = 6;

/** A Mantine color at one shade, for props that take a CSS value rather than
 * Mantine's own `color.shade` shorthand. */
export function colorVar(color: string, shade: number): string {
    return `var(--mantine-color-${color}-${shade})`;
}

/**
 * A mark that must read as secondary but stay legible on both themes, which
 * bare "gray" does not: a reference line, a bar for an unremarkable value.
 */
export const MUTED_MARK = `${StatusColor.NEUTRAL}.5`;

/**
 * A surface for a render to sit on. Onshape renders a part light, on white, so
 * a white card leaves the thumbnail with no edge to it; light mode steps down
 * far enough to give it one. Dark mode already has the contrast, so it keeps
 * the card's own background.
 */
export const RENDER_BACKGROUND =
    "light-dark(var(--mantine-color-gray-1), var(--mantine-color-body))";

/**
 * What a subtle gray control draws its icon in — the color Mantine resolves
 * `variant="subtle"` to. A bare icon standing beside one has to be given it,
 * or it takes the body text color and reads darker than its neighbours.
 */
export const CONTROL_ICON_COLOR = "var(--mantine-color-gray-light-color)";

/**
 * Paints an image in the current text color rather than its own. The url needs
 * quoting: Vite inlines an asset as a data uri, which can contain apostrophes.
 */
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

/**
 * One height for every navbar row, so the app's two tiers and the dashboard's
 * read as the same bar rather than three sizes of one.
 */
export const NAVBAR_ROW_HEIGHT = 48;

/**
 * A rule that has to read against the navbar's frame rather than a white page,
 * so it takes the same step off the frame in either theme.
 */
export const NAVBAR_DIVIDER_COLOR =
    "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))";

/** The app's primary color as a filled background. */
export enum PrimaryColor {
    /** The current library's color, e.g. green for FRCDesign. */
    FILLED = "var(--mantine-primary-color-filled)",
    /** What reads on top of it, typically white. */
    CONTRAST = "var(--mantine-primary-color-contrast)"
}
