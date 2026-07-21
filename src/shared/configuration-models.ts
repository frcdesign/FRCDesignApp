import { LogicalOp, QuantityType, Unit } from "./configuration-enums";

/** Discriminator of a parsed configuration parameter. */
export enum ParameterType {
    ENUM = "enum",
    QUANTITY = "quantity",
    BOOLEAN = "boolean",
    STRING = "string"
}

/** Discriminator of a parsed parameter visibility condition. */
export enum VisibilityType {
    LOGICAL = "logical",
    EQUAL = "equal",
    RANGE = "range",
    ALWAYS_SHOWN = "alwaysShown"
}

/** Discriminator of a parsed enum-option visibility condition. */
export enum OptionVisibilityType {
    LIST = "list",
    RANGE = "range"
}

export type OptionVisibilityCondition =
    | EqualOptionVisibilityCondition
    | RangeOptionVisibilityCondition;

export interface EqualOptionVisibilityCondition {
    type: OptionVisibilityType.LIST;
    controlledOptions: string[];
    condition: VisibilityCondition;
}

export interface RangeOptionVisibilityCondition {
    type: OptionVisibilityType.RANGE;
    start: string;
    end: string;
    condition: VisibilityCondition;
}

export type VisibilityCondition =
    | LogicalVisibilityCondition
    | EqualVisibilityCondition
    | RangeVisibilityCondition
    | AlwaysShownVisibilityCondition;

interface LogicalVisibilityCondition {
    type: VisibilityType.LOGICAL;
    operation: LogicalOp;
    children: VisibilityCondition[];
}

interface EqualVisibilityCondition {
    type: VisibilityType.EQUAL;
    id: string;
    value: string;
}

interface RangeVisibilityCondition {
    type: VisibilityType.RANGE;
    id: string;
    start: string;
    end: string;
}

interface AlwaysShownVisibilityCondition {
    type: VisibilityType.ALWAYS_SHOWN;
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
    /** Parameters excluded from configuration properties. */
    isCosmetic: boolean;
    condition?: VisibilityCondition;
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
    optionConditions: OptionVisibilityCondition[];
}

export interface QuantityParameterObj extends ParameterBase {
    type: ParameterType.QUANTITY;
    quantityType: QuantityType;
    defaultValue: number;
    min: number;
    max: number;
    unit: Unit; // Always UNITLESS for QuantityType.INTEGER and QuantityType.REAL
}

/**
 * A specific configuration, consisting of a mapping of parameterIds to the value.
 */
export type Configuration = Record<string, string>;

/**
 * Custom data collected from the current tab the user has open.
 */
export interface UnitInfo {
    angleUnit: Unit;
    lengthUnit: Unit;
    lengthPrecision: number;
    anglePrecision: number;
    realPrecision: number;
}
