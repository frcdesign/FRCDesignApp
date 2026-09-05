/**
 * The two forms a configuration takes, and the only place either is built.
 *
 * A selection — {@link Selection} — is what someone picked: every
 * parameter the insertable declares, each value canonically spelled. A
 * {@link ConfigurationKey} is that selection's identity: what it overrides,
 * encoded. The key is what addresses a render, so `toKey` is the one function
 * allowed to decide what "overrides" means.
 *
 * Canonicalizing is lossy: "2 + 3 in" evaluates away, so an expression survives
 * only inside the input the user typed it into.
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
        // "1in", "1 in", "(0.5 + 0.5) in" and "25.4 mm" are one configuration:
        // the parser reads them all to the same base value, which spells it in
        // the units and precision Onshape itself compares in. Unparseable
        // values ride as-is.
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
 * The one map anything past the insert menu is allowed to hold: every declared
 * parameter, each value canonical.
 *
 * Filled from the parameters' own defaults, so a partial map — a search hit
 * naming only its overrides, a favorite made before a parameter existed — comes
 * out whole. In parameter order, so equivalent selections spell the same way.
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
 * What a selection actually applies. Onshape doesn't apply a parameter its
 * condition rules out, so one that is hidden changes neither the render nor
 * what the user chose, and is left off.
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
 * render the same thing produce the same key, which is what lets one cache
 * entry serve both.
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

/**
 * A value spelled for a reader: a quantity in the unit its parameter declares,
 * rather than the base unit it is stored in. Everything else already reads as
 * it is stored.
 */
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
