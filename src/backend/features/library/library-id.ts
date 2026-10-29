export enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    CONFIG_LIB = "config-lib",
    MKCAD = "mkcad"
}

/** For callers with no choice of their own, and readers on a non-library tab. */
export const DEFAULT_LIBRARY = LibraryId.FRC_DESIGN_LIB;
