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
 * Hex, not a css var or a named color: Mantine parses `color` to derive border
 * and hover tints, and anything else silently resolves to black.
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
