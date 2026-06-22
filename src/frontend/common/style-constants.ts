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
     * The current primary color, typically white.
     *
     * Used to color the buttons that go over the colored app header.
     */
    PRIMARY = "var(--mantine-primary-color)",
    /**
     * The current library color, e.g., green for FRCDesign.
     */
    FILLED = "var(--mantine-primary-color-filled)",
    /**
     * The current library contrast color, typically white.
     */
    CONTRAST = "var(--mantine-primary-color-contrast)"
}

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
