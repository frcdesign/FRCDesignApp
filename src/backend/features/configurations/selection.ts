/**
 * The two forms a configuration takes, and the only place either is built.
 * Canonicalizing is lossy: "2 + 3 in" survives only in the input it was typed into.
 */
import {
    type ConfigurationKey,
    type ConfigurationParameter,
    ParameterType,
    type Selection
} from "./models";
import {
    DEFAULT_QUANTITY_PRECISION,
    decodeConfiguration,
    encodeConfiguration,
    evaluateCondition
} from "./utils";
import {
    evaluateBaseValue,
    formatBaseValue,
    formatValueWithUnits
} from "./input-parser";

/** The key of a selection that overrides nothing: the element's own defaults. */
export const ELEMENT_DEFAULT_KEY: ConfigurationKey = "";

/** Normalizes one parameter's raw value to its canonical spelling. */
export function canonicalizeValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    if (parameter.type === ParameterType.QUANTITY) {
        // "1in", "1 in" and "25.4 mm" are one configuration: the parser reads
        // them to one base value. Unparseable values ride as typed.
        const base = evaluateBaseValue(
            value,
            parameter.quantityType,
            parameter.unit
        );
        return base === undefined ? value.trim() : formatBaseValue(base);
    }
    if (parameter.type === ParameterType.BOOLEAN) {
        return value.trim().toLowerCase();
    }
    return value.trim();
}

/**
 * Every declared parameter, canonically spelled and in parameter order. Filled
 * from the defaults, so a partial map — a search hit's overrides — comes whole.
 */
export function toSelection(
    values: Partial<Selection>,
    parameters: ConfigurationParameter[]
): Selection {
    const selection: Selection = {};
    for (const parameter of parameters) {
        selection[parameter.id] = canonicalizeValue(
            parameter,
            values[parameter.id] ?? parameter.default
        );
    }
    return selection;
}

/**
 * What a selection actually applies: Onshape never applies a parameter its
 * condition hides, so a hidden one is left off.
 */
export function appliedValues(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const values: Selection = {};
    for (const parameter of parameters) {
        const value = selection[parameter.id];
        if (
            value !== undefined &&
            evaluateCondition(parameter.condition, selection, parameters)
        ) {
            values[parameter.id] = value;
        }
    }
    return values;
}

/**
 * A selection's identity: what it overrides, encoded. Two selections that
 * render the same thing key the same, and so share a cache entry.
 */
export function toKey(
    selection: Selection,
    parameters: ConfigurationParameter[]
): ConfigurationKey {
    const values = appliedValues(selection, parameters);
    const overrides: Selection = {};
    for (const parameter of parameters) {
        const value = values[parameter.id];
        if (value !== undefined && value !== parameter.default) {
            overrides[parameter.id] = value;
        }
    }
    return encodeConfiguration(overrides);
}

/** The selection a key names: its overrides, over the parameters' defaults. */
export function fromKey(
    key: ConfigurationKey,
    parameters: ConfigurationParameter[]
): Selection {
    return toSelection(decodeConfiguration(key), parameters);
}

/** A quantity in the unit its parameter declares, rather than the base unit it
 * is stored in; everything else already reads as stored. */
export function formatValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    if (parameter.type !== ParameterType.QUANTITY) {
        return value;
    }
    const base = evaluateBaseValue(
        value,
        parameter.quantityType,
        parameter.unit
    );
    return base === undefined
        ? value
        : formatValueWithUnits(
              base,
              parameter.unit,
              DEFAULT_QUANTITY_PRECISION
          );
}
