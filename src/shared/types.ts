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
    /** Marks a part the team made, so nobody sells it and it has no part number. */
    CUSTOM = "Custom",
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

/** Team-made, so it is expected to have no part number. */
export function isCustomPart(vendors: Vendor[]): boolean {
    return vendors.includes(Vendor.CUSTOM);
}

/**
 * Gets the full name of a vendor.
 */
export function getVendorName(vendor: Vendor) {
    switch (vendor) {
        case Vendor.AM:
            return "AndyMark";
        case Vendor.CUSTOM:
            return "Custom";
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
/**
 * The two thumbnail sizes we generate and store, as the `WxH` Onshape wants.
 * SMALL fills list rows; LARGE fills the hover card and the insert preview.
 */
export enum ThumbnailSize {
    SMALL = "70x40",
    LARGE = "300x300"
}

/** An element's two stored thumbnail URLs, produced (and stored) as a pair. */
export interface ThumbnailUrls {
    small: string;
    large: string;
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

/**
 * Server-provided access: the highest level granted plus sign-in state. The
 * level the app is currently viewed as is client-side (see useAccessData).
 */
export interface AccessData {
    maxAccessLevel: AccessLevel;
    signedIn: boolean;
}

export interface ContextData {
    accessData: AccessData;
    settings: Settings;
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
