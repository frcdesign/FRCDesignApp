/**
 * Standard icon sizes to pass to Phosphor icons. The first three are general
 * magnitudes for an icon sitting in a line of content; the rest each name the
 * one place they are used.
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
