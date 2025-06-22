/**
 * A collection of type and result definitions mirroring backend endpoints and/or Onshape.
 */
import { ElementPath, InstancePath } from "./path";

/**
 * The type of the Onshape tab the app is open in.
 */
export enum ElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY"
}

export enum ParameterType {
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

export interface ConfigurationResult {
    defaultConfiguration: string;
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
}
export interface BooleanParameterObj extends ParameterBase {
    type: ParameterType.BOOLEAN;
}

export interface StringParameterObj extends ParameterBase {
    type: ParameterType.STRING;
}

export interface EnumOption {
    id: string;
    name: string;
}

export interface EnumParameterObj extends ParameterBase {
    type: ParameterType.ENUM;
    options: EnumOption[];
}

export interface QuantityParameterObj extends ParameterBase {
    type: ParameterType.QUANTITY;
    quantityType: QuantityType;
    min: number;
    max: number;
    unit: Unit;
}

// export const getConfiguration = queryOptions<ConfigurationResult>({
//     queryKey: ["configuration", configurationId],
//     queryFn: ({queryKey }) => apiGet("/configuration/" + queryKey[1]),
//     staleTime: Infinity
// });

// class ParameterType(StrEnum):
//     ENUM = "BTMConfigurationParameterEnum-105"
//     QUANTITY = "BTMConfigurationParameterQuantity-1826"
//     BOOLEAN = "BTMConfigurationParameterBoolean-2550"
//     STRING = "BTMConfigurationParameterString-872"

// class QuantityType(StrEnum):
//     LENGTH = "LENGTH"
//     ANGLE = "ANGLE"
//     INTEGER = "INTEGER"
//     REAL = "REAL"

export interface DocumentResult {
    documents: DocumentObj[];
    elements: ElementObj[];
}

export interface DocumentObj extends InstancePath {
    id: string;
    name: string;
    elementIds: string[];
}

export interface ElementObj extends ElementPath {
    id: string;
    name: string;
    elementType: ElementType;
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
