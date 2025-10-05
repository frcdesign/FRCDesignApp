/**
 * A collection of type and result definitions mirroring backend endpoints and/or Onshape.
 */
import { ElementPath, InstancePath } from "./path";

export interface UserData {
    settings: Settings;
    favorites: Favorites;
    favoriteOrder: string[];
}

export enum Theme {
    SYSTEM = "system",
    LIGHT = "light",
    DARK = "dark"
}

export interface Settings {
    theme: Theme;
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

export enum ConfigurationParameterType {
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

export function getDisplayStr(unit: Unit): string {
    switch (unit) {
        case Unit.METER:
            return "m";
        case Unit.CENTIMETER:
            return "cm";
        case Unit.MILLIMETER:
            return "mm";
        case Unit.YARD:
            return "yd";
        case Unit.FOOT:
            return "ft";
        case Unit.INCH:
            return "in";
        case Unit.DEGREE:
            return "deg";
        case Unit.RADIAN:
            return "rad";
        case Unit.UNITLESS:
            return "";
    }
}

export enum OptionVisibilityConditionType {
    LIST = "BTEnumOptionVisibilityForList-1613",
    RANGE = "BTEnumOptionVisibilityForRange-4297"
}

export type OptionVisibilityCondition =
    | EqualOptionVisibilityCondition
    | RangeOptionVisibilityCondition;

export interface EqualOptionVisibilityCondition {
    type: OptionVisibilityConditionType.LIST;
    controlledOptions: string[];
    condition: VisibilityCondition;
}

export interface RangeOptionVisibilityCondition {
    type: OptionVisibilityConditionType.RANGE;
    start: string;
    end: string;
    condition: VisibilityCondition;
}

export enum VisibilityConditionType {
    LOGICAL = "BTParameterVisibilityLogical-178",
    EQUAL = "BTParameterVisibilityOnEqual-180",
    RANGE = "BTParameterVisibilityInRange-2980"
}

export type VisibilityCondition =
    | LogicalVisibilityCondition
    | EqualVisibilityCondition
    | RangeVisibilityCondition;

interface LogicalVisibilityCondition {
    type: VisibilityConditionType.LOGICAL;
    operation: LogicalOp;
    children: VisibilityCondition[];
}

export enum LogicalOp {
    AND = "AND",
    OR = "OR"
}

interface EqualVisibilityCondition {
    type: VisibilityConditionType.EQUAL;
    id: string;
    value: string;
}

interface RangeVisibilityCondition {
    type: VisibilityConditionType.RANGE;
    id: string;
    start: string;
    end: string;
}

/**
 * Evaluates a visibility condition.
 * Returns true if the controlled part should be shown, and false otherwise.
 */
export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    configuration: Record<string, string>,
    parameters: ParameterObj[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type == VisibilityConditionType.LOGICAL) {
        if (condition.operation == LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        } else {
            return condition.children.some((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        }
    } else if (condition.type == VisibilityConditionType.EQUAL) {
        return condition.value == configuration[condition.id];
    } else if (condition.type == VisibilityConditionType.RANGE) {
        const parameter = parameters.find(
            (parameter) => parameter.id === condition.id
        );
        if (!parameter || parameter.type != ConfigurationParameterType.ENUM) {
            throw new Error(
                "Visibility condition does not target a valid enum parameter."
            );
        }

        const optionIds = parameter.options.map((option) => option.id);
        const startIndex = optionIds.indexOf(condition.start);
        const endIndex = optionIds.indexOf(condition.end);
        return optionIds
            .slice(startIndex, endIndex + 1)
            .includes(configuration[condition.id]);
    }
    return true;
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
    condition?: VisibilityCondition;
}
export interface BooleanParameterObj extends ParameterBase {
    type: ConfigurationParameterType.BOOLEAN;
}

export interface StringParameterObj extends ParameterBase {
    type: ConfigurationParameterType.STRING;
}

export interface EnumOption {
    id: string;
    name: string;
}

export interface EnumParameterObj extends ParameterBase {
    type: ConfigurationParameterType.ENUM;
    options: EnumOption[];
    optionConditions: OptionVisibilityCondition[];
}

export interface QuantityParameterObj extends ParameterBase {
    type: ConfigurationParameterType.QUANTITY;
    quantityType: QuantityType;
    defaultValue: number;
    min: number;
    max: number;
    unit: Unit; // Always UNITLESS for QuantityType.INTEGER and QuantityType.REAL
}

export type Documents = Record<string, DocumentObj>;

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

export type DocumentOrder = string[];

export interface DocumentObj extends InstancePath {
    id: string;
    name: string;
    thumbnailElementId: string;
    elementIds: string[];
    sortAlphabetically: boolean;
}

export type Elements = Record<string, ElementObj>;

export interface ElementObj extends ElementPath {
    id: string;
    name: string;
    documentId: string;
    elementType: ElementType;
    microversionId: string;
    isVisible: boolean;
    vendor?: Vendor;
    configurationId?: string;
}

export type Favorites = Record<string, Favorite>;

export interface Favorite {
    id: string;
    defaultConfiguration?: Configuration;
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

/**
 * Custom data collected from the current tab the user has open.
 */
export interface ContextData {
    maxAccessLevel: AccessLevel;
    currentAccessLevel: AccessLevel;
    angleUnit: Unit;
    lengthUnit: Unit;
    lengthPrecision: number;
    anglePrecision: number;
    realPrecision: number;
    cacheVersion: number;
}
