/**
 * A collection of type and result definitions mirroring backend endpoints and/or Onshape.
 */
import { Configuration } from "../insert/configuration-models";
import { ElementPath, InstancePath } from "./path";

export enum Library {
    FRC_DESIGN_LIB = "frc-design-lib",
    FTC_DESIGN_LIB = "ftc-design-lib",
    MKCAD = "mkcad"
}

export interface LibraryUserData {
    // recentElements:
    favorites: Favorites;
    favoriteOrder: string[];
}

export type Favorites = Record<string, Favorite | undefined>;

export interface Favorite {
    id: string;
    defaultConfiguration?: Configuration;
}

export enum AccessLevel {
    ADMIN = "admin",
    MEMBER = "member",
    USER = "user"
}

export function hasAdminAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.ADMIN;
}

export function hasMemberAccess(accessLevel: AccessLevel) {
    return (
        accessLevel === AccessLevel.ADMIN || accessLevel === AccessLevel.MEMBER
    );
}

export function hasUserAccess(accessLevel: AccessLevel) {
    return accessLevel === AccessLevel.USER;
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

/**
 * The type of the Onshape tab the app is open in.
 */
export enum ElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY"
}

export interface LibraryObj {
    documentOrder: string[];
    documents: Documents;
    elements: Elements;
}

export type Documents = Record<string, DocumentObj>;
export type Elements = Record<string, ElementObj>;

export interface DocumentObj extends InstancePath {
    id: string;
    name: string;
    thumbnailElementId: string;
    sortAlphabetically: boolean;
    elementOrder: string[];
}

export interface ElementObj extends ElementPath {
    id: string;
    documentId: string;

    name: string;
    elementType: ElementType;
    microversionId: string;
    isVisible: boolean;
    vendors: Vendor[];
    configurationId?: string;
}

export enum ThumbnailSize {
    STANDARD = "300x300",
    LARGE = "600x340",
    SMALL = "300x170",
    TINY = "70x40"
}

export function getHeightAndWidth(size: ThumbnailSize): {
    height: number;
    width: number;
} {
    const parts = size.split("x");
    return { width: parseInt(parts[0]), height: parseInt(parts[1]) };
}

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

export interface ContextData {
    maxAccessLevel: AccessLevel;
    currentAccessLevel: AccessLevel;
    cacheVersion: number;
}

export interface Settings {
    theme: Theme;
    library: Library;
}

export interface UserData {
    // We could also move LibraryUserData in here
    settings: Settings;
}
