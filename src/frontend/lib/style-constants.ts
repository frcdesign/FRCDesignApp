/**
 * Standard icon sizes to pass to Phosphor icons.
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
