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
    | ListOptionVisibilityCondition
    | RangeOptionVisibilityCondition;

interface ListOptionVisibilityCondition {
    type: OptionVisibilityType.LIST;
    controlledOptions: string[];
    condition: VisibilityCondition;
}

interface RangeOptionVisibilityCondition {
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
    parameters: ConfigurationParameter[];
    /** Every record probed, so the insert menu can show the part number and
     * name of the selected configuration. Empty when not indexed. */
    records: SearchRecord[];
}

/**
 * A {@link ConfigurationRecord} as a client reads it: what the part is called,
 * where to buy it, and the configuration that produces it. MiniSearch-free, so
 * the index and the `/configuration` route can share it.
 */
export interface SearchRecord {
    partNumber?: string;
    name?: string;
    /** The vendor's page for this part, when one can be resolved. */
    url?: string;
    /** The enumerated values producing it; empty for the element's defaults. */
    values: PartialSelection;
    /** Those values' key, which is only for naming its thumbnail. */
    configurationKey: ConfigurationKey;
}

export type ConfigurationParameter =
    | EnumParameter
    | QuantityParameter
    | BooleanParameter
    | StringParameter;

interface ConfigurationParameterBase {
    id: string;
    name: string;
    default: string;
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
 * What someone picked, keyed by parameter id: every declared parameter, each
 * value as it was entered — a quantity is the expression typed, "(2 + 3) in",
 * never the number it evaluates to. `toSelection` is what makes one.
 */
export type Selection = Record<string, string>;

/**
 * A selection still being built: enumeration names only what it varies, and a
 * search hit only what it records. `toSelection` is what makes one whole.
 */
export type PartialSelection = Partial<Selection>;

/**
 * A selection's identity, for addressing its thumbnail and nothing else: what
 * it overrides, canonically spelled, so two selections rendering the same part
 * share one render. Never stored in place of the selection it came from.
 * {@link DEFAULT_CONFIGURATION_KEY} — empty — overrides nothing.
 */
export type ConfigurationKey = string;

/**
 * The key of a selection that overrides nothing: the element's own defaults. Here
 * rather than in `selection.ts`, which `utils.ts` would have to import back from.
 */
export const DEFAULT_CONFIGURATION_KEY: ConfigurationKey = "";

/**
 * The part one probe resolved to: the element itself from its own defaults, a
 * {@link ConfigurationRecord} from any other selection.
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

/** What one probe came back with, and the enumerated values it probed. */
export interface ConfigurationRecord extends PartMetadata {
    /**
     * The enum and boolean values enumeration chose; every other parameter was
     * at its default. Empty for the element's own defaults.
     */
    values: PartialSelection;
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
