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

export function getUnitDisplayStr(unit: Unit): string {
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
