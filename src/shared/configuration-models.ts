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
    parameters: ConfigurationParameter[];
}

export type ConfigurationParameter =
    | EnumParameter
    | QuantityParameter
    | BooleanParameter
    | StringParameter;

export interface ConfigurationParameterBase {
    id: string;
    name: string;
    default: string;
    /** Parameters excluded from configuration properties. */
    isCosmetic: boolean;
    condition?: VisibilityCondition;
}
export interface BooleanParameter extends ConfigurationParameterBase {
    type: ParameterType.BOOLEAN;
}

export interface StringParameter extends ConfigurationParameterBase {
    type: ParameterType.STRING;
}

export interface EnumOption {
    id: string;
    name: string;
}

export interface EnumParameter extends ConfigurationParameterBase {
    type: ParameterType.ENUM;
    options: EnumOption[];
    optionConditions: OptionVisibilityCondition[];
}

export interface QuantityParameter extends ConfigurationParameterBase {
    type: ParameterType.QUANTITY;
    quantityType: QuantityType;
    defaultValue: number;
    min: number;
    max: number;
    unit: Unit; // Always UNITLESS for QuantityType.INTEGER and QuantityType.REAL
}

/**
 * A specific choice of values for an insertable's parameters, as a mapping of
 * parameterId to value.
 */
export type ParameterValues = Record<string, string>;

/**
 * Everything a single checked configuration resolves to. One is stored per
 * configuration we probe, so search, the UI, and future build checks can read
 * back what each configuration produces without re-querying Onshape.
 */
export interface ConfigurationRecord {
    /** The parameter values that produce it; empty means the element's defaults. */
    configuration: ParameterValues;
    partNumber: string | null;
    name: string | null;
    description: string | null;
    /** Material display name, e.g. "6061 Aluminum". */
    material: string | null;
    vendor: string | null;
    /** True when a part studio resolved to more than one part. */
    hasMultipleParts: boolean;
}

/**
 * An insertable's configuration: the parameters it exposes and a record for each
 * configuration we probed. Mirrors the `configurations` row.
 */
export interface Configuration {
    parameters: ConfigurationParameter[];
    records: ConfigurationRecord[];
}

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
