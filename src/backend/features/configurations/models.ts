import { LogicalOp, QuantityType, Unit } from "./enums";

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
    /** The insertable's search records, so the insert menu can show the part
     * number + name of the selected configuration. Empty when not indexed. */
    records: SearchRecord[];
}

/**
 * The slice of a {@link ConfigurationRecord} search needs. MiniSearch-free, so
 * the index and the `/configuration` route can share it.
 */
export interface SearchRecord {
    partNumber?: string;
    name?: string;
    /** The vendor's page for this part, when one can be resolved. */
    url?: string;
    /**
     * The (enumerated) parameter values that produce it, canonical so it keys
     * the same render the insert menu asks for; empty for the default.
     */
    canonicalConfiguration: ParameterValues;
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
 * What one probed configuration resolves to. Stored per probe, so search and the
 * UI can read it back without re-querying Onshape.
 */
/**
 * The part an element resolves to, as one probe read it: from the element's own
 * defaults it describes the element, from one configuration a
 * {@link ConfigurationRecord}.
 */
export interface PartMetadata {
    partNumber?: string;
    name?: string;
    description?: string;
    /** Material display name, e.g. "6061 Aluminum". */
    material?: string;
    /** Onshape's own, or parsed from the part and its options when it has none. */
    vendor?: string;
    /** True when the part studio resolved to more than one part. */
    hasMultipleParts: boolean;
    /** Whether this probe resolved to an open composite. */
    isOpenComposite: boolean;
}

/**
 * {@link PartMetadata} for one selection, as it came back from Onshape — keyed
 * by the selection as written rather than as it is stored.
 */
export interface ProbedRecord extends PartMetadata {
    /** The selection probed, before it is canonicalized for storage. */
    configuration: ParameterValues;
}

/** A probe as it is stored. Kept only for an indexed insertable. */
export interface ConfigurationRecord extends PartMetadata {
    /** The parameter values that produce it, in their canonical spelling. */
    canonicalConfiguration: ParameterValues;
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
 * The current document's units. Every field is optional: an absent one leaves
 * the quantity on its own default unit.
 */
export interface UnitInfo {
    angleUnit?: Unit;
    lengthUnit?: Unit;
    lengthPrecision?: number;
    anglePrecision?: number;
    realPrecision?: number;
}

/** No document units available; each quantity falls back to its own unit. */
export const EMPTY_UNIT_INFO: UnitInfo = {};
