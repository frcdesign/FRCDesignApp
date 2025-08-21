/**
 * A collection of type and result definitions mirroring backend endpoints and/or Onshape.
 */
import { ElementPath, InstancePath } from "./path";

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

export enum Vendor {
    AM = "AM",
    LAI = "LAI",
    MCM = "MCM",
    REDUX = "Redux",
    REV = "REV",
    SDS = "SDS",
    SWYFT = "Swyft",
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
            return "Swyft";
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

export enum ConfigurationType {
    ENUM = "BTMConfigurationParameterEnum-105",
    QUANTITY = "BTMConfigurationParameterQuantity-1826",
    BOOLEAN = "BTMConfigurationParameterBoolean-2550",
    STRING = "BTMConfigurationParameterString-872"
}

export enum QuantityType {
    LENGTH = "LENGTH",
    ANGLE = "ANGLE",
    INTEGER = "INTEGER",
    REAL = "REAL"
}

export enum Unit {
    METER = "meter",
    CENTIMETER = "centimeter",
    MILLIMETER = "millimeter",
    YARD = "yard",
    FOOT = "foot",
    INCH = "inch",
    DEGREE = "degree",
    RADIAN = "radian",
    UNITLESS = ""
}

export enum ConditionType {
    LOGICAL = "BTParameterVisibilityLogical-178",
    EQUAL = "BTParameterVisibilityOnEqual-180"
}

export enum LogicalOp {
    AND = "AND",
    OR = "OR"
}

export type VisibilityCondition = LogicalCondition | EqualCondition;

interface LogicalCondition {
    type: ConditionType.LOGICAL;
    operation: LogicalOp;
    children: VisibilityCondition[];
}

interface EqualCondition {
    type: ConditionType.EQUAL;
    id: string;
    value: string;
}

export function evaluateCondition(
    condition: VisibilityCondition | null,
    configuration: Record<string, string>
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type == ConditionType.LOGICAL) {
        if (condition.operation == LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, configuration)
            );
        } else {
            return condition.children.some((child) =>
                evaluateCondition(child, configuration)
            );
        }
    } else {
        return configuration[condition.id] == condition.value;
    }
}

export interface ConfigurationResult {
    // defaultConfiguration: string;
    parameters: ParameterObj[];
}

export type ParameterObj =
    | EnumParameterObj
    | QuantityParameterObj
    | BooleanParameterObj
    | StringParameterObj;

export interface ParameterBase {
    id: string;
    name: string;
    default: string;
    visibilityCondition: VisibilityCondition | null;
}
export interface BooleanParameterObj extends ParameterBase {
    type: ConfigurationType.BOOLEAN;
}

export interface StringParameterObj extends ParameterBase {
    type: ConfigurationType.STRING;
}

export interface EnumOption {
    id: string;
    name: string;
}

export interface EnumParameterObj extends ParameterBase {
    type: ConfigurationType.ENUM;
    options: EnumOption[];
}

export interface QuantityParameterObj extends ParameterBase {
    type: ConfigurationType.QUANTITY;
    quantityType: QuantityType;
    min: number;
    max: number;
    unit: Unit;
}

export type DocumentsResult = Record<string, DocumentObj>;

// export enum ListElementType {
//     DOCUMENT = "document",
//     // We don't currently support folders, but we'll define them now so it's easier to add them later
//     FOLDER = "folder"
// }

// export type ListElement = DocumentListElement | FolderListElement;

// export interface DocumentListElement {
//     type: ListElementType.DOCUMENT;
//     id: string;
// }

// export interface FolderListElement {
//     type: ListElementType.FOLDER;
//     id: string;
//     // Only allowed to be documentIds
//     childrenIds: string[];
// }

export type DocumentOrderResult = string[];

export interface DocumentObj extends InstancePath {
    id: string;
    name: string;
    elementIds: string[];
    sortByDefault: boolean;
}

export type ElementsResult = Record<string, ElementObj>;

export interface ElementObj extends ElementPath {
    id: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
    isVisible: boolean;
    vendor?: string;
    configurationId?: string;
}

export type FavoritesResult = Record<string, Favorite>;

/**
 * A favorite is currently just an empty object.
 * We may add additional information in the future.
 */
export interface Favorite {
    id: string;
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

/**
 * Encodes a configuration into a string.
 * Used to send configurations as a query parameter to the backend.
 */
export function encodeConfigurationForQuery(
    configuration?: Configuration
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

export type Configuration = Record<string, string>;

// export function isConfigurationValid(
//     configuration: Configuration
// ): configuration is Record<string, string> {
//     return Object.values(configuration).every((value) => value !== undefined);
// }
