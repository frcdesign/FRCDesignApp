export enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    FTC_DESIGN_LIB = "ftc-design-lib",
    MKCAD = "mkcad"
}

/**
 * The library the app falls back to: what a caller with no choice of their own
 * opens in, and what a library-scoped reader uses when the tab showing is not
 * a library.
 */
export const DEFAULT_LIBRARY = LibraryId.FRC_DESIGN_LIB;
