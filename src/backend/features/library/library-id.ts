export enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    FTC_DESIGN_LIB = "ftc-design-lib",
    MKCAD = "mkcad"
}

/** For callers with no choice of their own, and readers on a non-library tab. */
export const DEFAULT_LIBRARY = LibraryId.FRC_DESIGN_LIB;
