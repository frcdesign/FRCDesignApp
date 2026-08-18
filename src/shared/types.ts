export enum AccessLevel {
    ADMIN = "admin",
    EDITOR = "editor",
    USER = "user"
}

export function hasAdminAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.ADMIN;
}

export function hasEditorAccess(accessLevel: AccessLevel) {
    return (
        accessLevel === AccessLevel.ADMIN || accessLevel === AccessLevel.EDITOR
    );
}

export function hasUserAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.USER;
}

const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
    [AccessLevel.USER]: 0,
    [AccessLevel.EDITOR]: 1,
    [AccessLevel.ADMIN]: 2
};

/** Whether `accessLevel` grants no more than `maxAccessLevel` does. */
export function isWithinAccessLevel(
    accessLevel: AccessLevel,
    maxAccessLevel: AccessLevel
): boolean {
    return ACCESS_LEVEL_RANK[accessLevel] <= ACCESS_LEVEL_RANK[maxAccessLevel];
}

export enum Vendor {
    AM = "AM",
    LAI = "LAI",
    MCM = "MCM",
    REDUX = "Redux",
    REV = "REV",
    SDS = "SDS",
    SWYFT = "SWYFT",
    TTB = "TTB",
    VEX = "VEX",
    WCP = "WCP"
}

/**
 * Gets the full name of a vendor.
 */
export function getVendorName(vendor: Vendor) {
    switch (vendor) {
        case Vendor.AM:
            return "AndyMark";
        case Vendor.LAI:
            return "Last Anvil Innovations";
        case Vendor.MCM:
            return "McMaster-Carr";
        case Vendor.REDUX:
            return "Redux Robotics";
        case Vendor.REV:
            return "REV Robotics";
        case Vendor.SDS:
            return "Swerve Drive Specialties";
        case Vendor.SWYFT:
            return "SWYFT";
        case Vendor.TTB:
            return "The Thrifty Bot";
        case Vendor.VEX:
            return "VEXpro";
        case Vendor.WCP:
            return "West Coast Products";
    }
}
export enum ThumbnailSize {
    STANDARD = "300x300",
    LARGE = "600x340",
    SMALL = "300x170",
    TINY = "70x40"
}
export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

/** User settings, which the entry redirect reads and seeds the app with. */
export interface Settings {
    theme: Theme;
}

export interface SettingsUpdate {
    theme?: Theme;
    libraryId?: LibraryId;
}

export interface AccessData {
    maxAccessLevel: AccessLevel;
    currentAccessLevel: AccessLevel;
    /** Whether the caller has a valid Onshape session (see backend isSignedIn). */
    signedIn: boolean;
}

export interface ThumbnailUrls {
    [ThumbnailSize.TINY]: string;
    [ThumbnailSize.STANDARD]: string;
}
export enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    FTC_DESIGN_LIB = "ftc-design-lib",
    MKCAD = "mkcad"
}

/**
 * The type of the Onshape tab the app is open in.
 */
export enum ElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY"
}

export interface FastenInfo {
    mateConnectorId: string;
    mateLocation: MateLocation;
    path: string[];
}

export enum MateLocation {
    Feature = "Feature",
    Part = "Part",
    Subassembly = "Subassembly"
}

export const DEFAULT_SETTINGS: Settings = {
    theme: Theme.SYSTEM
};

/** The library a user lands in before they have picked one. */
export const DEFAULT_LIBRARY_ID = LibraryId.FRC_DESIGN_LIB;
