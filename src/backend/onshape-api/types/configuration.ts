/**
 * Hand-authored types for the Onshape configuration endpoint responses.
 *
 * These are the types we actually import. They are maintained by hand (using our own
 * enums + comments) against the generated reference slice in `../generated` — regenerate
 * it with `npm run gen:onshape-types` and fold any upstream drift in here.
 *
 * `btType` discriminants reuse the shared `ConfigurationParameterType` /
 * `VisibilityConditionType` / `OptionVisibilityConditionType` enums so raw responses and
 * the parsed app models speak the same language.
 */
import {
    ConfigurationParameterType,
    LogicalOp,
    OptionVisibilityConditionType,
    QuantityType,
    Unit,
    VisibilityConditionType
} from "../../../shared/configuration-models";

/** btType Onshape attaches to an always-visible (unconditional) parameter/option. */
export const VISIBILITY_CONDITION_NONE = "BTParameterVisibilityCondition-177";

// --- visibility conditions --------------------------------------------------------

export interface OnshapeLogicalVisibility {
    btType: VisibilityConditionType.LOGICAL;
    operation: LogicalOp;
    children: OnshapeVisibilityCondition[];
}

export interface OnshapeEqualVisibility {
    btType: VisibilityConditionType.EQUAL;
    parameterId: string;
    value: string;
}

export interface OnshapeRangeVisibility {
    btType: VisibilityConditionType.RANGE;
    parameterId: string;
    optionRange: OnshapeOptionRange;
}

export interface OnshapeAlwaysShownVisibility {
    btType: VisibilityConditionType.ALWAYS_SHOWN;
}

/** The "no condition" sentinel (also appears as a child of logical conditions). */
export interface OnshapeNoVisibility {
    btType: typeof VISIBILITY_CONDITION_NONE;
}

export type OnshapeVisibilityCondition =
    | OnshapeLogicalVisibility
    | OnshapeEqualVisibility
    | OnshapeRangeVisibility
    | OnshapeAlwaysShownVisibility
    | OnshapeNoVisibility;

/** A `[start, end]` range over an enum parameter's ordered options. */
export interface OnshapeOptionRange {
    start: string;
    end: string;
}

// --- enum option visibility conditions --------------------------------------------

export interface OnshapeOptionVisibilityForList {
    btType: OptionVisibilityConditionType.LIST;
    controlledOptions: string[];
    condition: OnshapeVisibilityCondition;
}

export interface OnshapeOptionVisibilityForRange {
    btType: OptionVisibilityConditionType.RANGE;
    controlledRange: OnshapeOptionRange;
    condition: OnshapeVisibilityCondition;
}

export type OnshapeEnumOptionVisibilityCondition =
    | OnshapeOptionVisibilityForList
    | OnshapeOptionVisibilityForRange;

export interface OnshapeEnumOptionVisibilityConditionList {
    visibilityConditions: OnshapeEnumOptionVisibilityCondition[];
}

// --- configuration parameters -----------------------------------------------------

export interface OnshapeEnumOption {
    option: string;
    optionName: string;
}

export interface OnshapeQuantityRange {
    units: Unit;
    defaultValue: number;
    minValue: number;
    maxValue: number;
}

interface OnshapeParameterBase {
    parameterId: string;
    parameterName: string;
    isCosmetic: boolean;
    visibilityCondition: OnshapeVisibilityCondition;
}

export interface OnshapeEnumParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.ENUM;
    defaultValue: string;
    options: OnshapeEnumOption[];
    enumOptionVisibilityConditions?: OnshapeEnumOptionVisibilityConditionList;
}

export interface OnshapeBooleanParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.BOOLEAN;
    defaultValue: boolean;
}

export interface OnshapeStringParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.STRING;
    defaultValue: string;
}

export interface OnshapeQuantityParameter extends OnshapeParameterBase {
    btType: ConfigurationParameterType.QUANTITY;
    quantityType: QuantityType;
    rangeAndDefault: OnshapeQuantityRange;
}

export type OnshapeConfigurationParameter =
    | OnshapeEnumParameter
    | OnshapeBooleanParameter
    | OnshapeStringParameter
    | OnshapeQuantityParameter;

/** GET /elements/.../configuration response. */
export interface OnshapeConfigurationResponse {
    btType: "BTConfigurationResponse-2019";
    configurationParameters: OnshapeConfigurationParameter[];
}

// --- configuration encodings ------------------------------------------------------

export interface OnshapeConfigurationInfoEntry {
    parameterId: string;
    parameterValue: string;
}

/** GET /elements/.../configurationencodings/{cid} response. */
export interface OnshapeConfigurationInfo {
    parameters: OnshapeConfigurationInfoEntry[];
}
