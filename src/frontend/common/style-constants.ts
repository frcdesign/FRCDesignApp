/**
 * Standard icon sizes to pass to Tabler icons.
 */
export enum IconSize {
    /** Icons on badges */
    TINY = 12,
    /** Menu options */
    SMALL = 16,
    /** Buttons */
    MEDIUM = 18,
    /** Input-height controls, which sit next to full-height buttons */
    CONTROL = 24,
    /** In-line error states */
    LARGE = 36,
    /** Full-page error states */
    HUGE = 48
}

/**
 * Standard Mantine FontWeights.
 */
export enum FontWeight {
    SEMI_BOLD = 500,
    BOLD = 700
}

/**
 * Creates a Mantine-style border.
 */
export const BORDER = "1px solid var(--mantine-color-default-border)";

/** The app's primary color as a filled background. */
export enum PrimaryColor {
    /**
     * The current library color, e.g., green for FRCDesign.
     */
    FILLED = "var(--mantine-primary-color-filled)",
    /**
     * The current library contrast color, typically white.
     */
    CONTRAST = "var(--mantine-primary-color-contrast)"
}

/**
 * The `color` for Mantine controls sitting on the filled header. Hex, and not
 * {@link PrimaryColor.CONTRAST} or `"white"`: Mantine derives each variant's
 * border and hover tint by parsing `color`, and its parser understands only
 * hex/rgb/hsl — a css var or a named color silently resolves to black.
 */
export const HEADER_CONTROL_COLOR = "#fff";

/** Red used for heart/favorite icons. */
export const HeartIconColor = "var(--mantine-color-red-6)";

/**
 * Icon color intents for use with Tabler icons.
 * For native mantine components, just use yellow, red, blue, etc. directly.
 */
export enum IconColor {
    YELLOW = "var(--mantine-color-yellow-6)",
    BLUE = "var(--mantine-color-blue-6)",
    RED = HeartIconColor,
    GREEN = "var(--mantine-color-green-6)"
}
