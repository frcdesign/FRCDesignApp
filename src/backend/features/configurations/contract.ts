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
    /** Empty when not indexed. */
    records: SearchRecord[];
}

/** MiniSearch-free, so the index and `/configuration` share it. */
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

/** Parameters about how a part is derived or drawn, not which part it is; see `roles.ts`. */
export enum ParameterRole {
    /** Onshape refuses a second derive of the same configuration, so this gets a unique value. */
    DERIVATION_VARIABLE = "derivation-variable",
    COLOR = "color",
    /** One of a color's R, G and B, when a part spells a color out as three. */
    COLOR_CHANNEL = "color-channel",
    TESSELLATION = "tessellation"
}

interface ConfigurationParameterBase {
    id: string;
    name: string;
    default: string;
    condition?: VisibilityCondition;
    /** Absent for an ordinary parameter, which is most of them. */
    role?: ParameterRole;
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

/** Every declared parameter, as entered; see AGENTS.md. */
export type Selection = Record<string, string>;

/** `toSelection` makes one whole. */
export type PartialSelection = Partial<Selection>;

/** Names a selection's thumbnail and nothing else; see AGENTS.md. */
export type ConfigurationKey = string;

// Here rather than in `selection.ts` to avoid an import cycle with `utils.ts`.
export const DEFAULT_CONFIGURATION_KEY: ConfigurationKey = "";

/** The part one probe resolved to. */
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
    /** The enum and boolean values enumeration chose; empty for the defaults. */
    values: PartialSelection;
}

/** Mirrors the `configurations` row. */
export interface Configuration {
    parameters: ConfigurationParameter[];
    records: ConfigurationRecord[];
}

/** A document's units, which quantities are shown in. */
export interface UnitInfo {
    angleUnit: Unit;
    lengthUnit: Unit;
    lengthPrecision: number;
    anglePrecision: number;
    realPrecision: number;
}
