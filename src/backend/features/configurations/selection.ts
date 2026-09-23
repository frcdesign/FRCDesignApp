/**
 * The two forms a configuration takes, and the only place either is built.
 *
 * A selection is what someone picked, spelled as they picked it, and it is what
 * Onshape is sent and what gets stored. A key is derived from one only to name
 * its thumbnail: it canonicalizes, which loses the expression that was typed.
 */
import {
    type ConfigurationKey,
    type ConfigurationParameter,
    type ConfigurationRecord,
    ParameterType,
    type PartialSelection,
    type QuantityParameter,
    type Selection
} from "./contract";
import { getUnitDisplayStr } from "./enums";
import {
    DEFAULT_QUANTITY_PRECISION,
    encodeConfiguration,
    evaluateCondition
} from "./utils";
import {
    evaluateBaseValue,
    formatBaseValue,
    formatValueWithUnits
} from "./input-parser";

/**
 * A quantity's default as Onshape declares it, in the parameter's own unit:
 * "1 in". What a quantity's `default` is spelled as.
 */
export function quantityDefault(
    parameter: Pick<QuantityParameter, "defaultValue" | "unit">
): string {
    const abbreviation = getUnitDisplayStr(parameter.unit);
    const value = String(parameter.defaultValue);
    return abbreviation ? `${value} ${abbreviation}` : value;
}

/**
 * Every declared parameter, and nothing else. What arrived is kept as it was
 * entered, except that a checkbox is spelled the one way Onshape spells it and
 * a quantity loses surrounding whitespace; what is missing takes its default.
 */
export function toSelection(
    values: PartialSelection,
    parameters: ConfigurationParameter[]
): Selection {
    const selection: Selection = {};
    for (const parameter of parameters) {
        const value = values[parameter.id] ?? parameter.default;
        if (parameter.type === ParameterType.BOOLEAN) {
            selection[parameter.id] = value.trim().toLowerCase();
        } else if (parameter.type === ParameterType.QUANTITY) {
            selection[parameter.id] = value.trim();
        } else {
            selection[parameter.id] = value;
        }
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
 * One spelling per value: a quantity in base units, so "1in", "1 in" and
 * "25.4 mm" agree. An unparseable quantity keeps its own spelling.
 */
export function canonicalValue(
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
    return base === undefined ? value : formatBaseValue(base);
}

/**
 * The applied values, canonically spelled: what two selections are compared by,
 * and what analytics counts, where "5 in" and "(2 + 3) in" are one value.
 */
export function canonicalValues(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const applied = appliedValues(selection, parameters);
    const values: Selection = {};
    for (const parameter of parameters) {
        const value = applied[parameter.id];
        if (value !== undefined) {
            values[parameter.id] = canonicalValue(parameter, value);
        }
    }
    return values;
}

/** Whether a value is the parameter's default, however either is spelled. */
function isDefault(parameter: ConfigurationParameter, value: string): boolean {
    return (
        canonicalValue(parameter, value) ===
        canonicalValue(parameter, parameter.default)
    );
}

/**
 * What Onshape is told: only what the selection changes from the element's
 * defaults, each value as it was entered, so a typed "(2 + 3) in" reaches
 * Onshape as that. Empty for the element's defaults.
 */
export function onshapeOverrides(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const values = appliedValues(selection, parameters);
    const overrides: Selection = {};
    for (const parameter of parameters) {
        const value = values[parameter.id];
        if (value !== undefined && !isDefault(parameter, value)) {
            overrides[parameter.id] = value;
        }
    }
    return overrides;
}

/**
 * A selection's thumbnail identity: what it overrides, canonically spelled.
 * Two selections that render the same part key the same.
 */
export function toKey(
    selection: Selection,
    parameters: ConfigurationParameter[]
): ConfigurationKey {
    const overrides = onshapeOverrides(selection, parameters);
    const canonical: Selection = {};
    for (const parameter of parameters) {
        const value = overrides[parameter.id];
        if (value !== undefined) {
            canonical[parameter.id] = canonicalValue(parameter, value);
        }
    }
    return encodeConfiguration(canonical);
}

/**
 * The shortest configuration that is not empty: the first parameter the
 * selection applies, at the value it applies. Onshape fills the rest in from the
 * element's own defaults, so it names the same part no overrides do — for a
 * caller that must hand Onshape a configuration but cannot hand it an empty one.
 *
 * Itself empty only when a condition hides every parameter the element has.
 */
export function toShortestConfiguration(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const values = appliedValues(selection, parameters);
    const first = parameters.find(
        (parameter) => values[parameter.id] !== undefined
    );
    return first === undefined ? {} : { [first.id]: values[first.id] };
}

/**
 * The record a selection produces. Records name only what enumeration varied,
 * so several can match — the element's own, naming nothing, always does — and
 * the one naming the most wins.
 */
export function findRecord<T extends Pick<ConfigurationRecord, "values">>(
    selection: Selection,
    records: T[]
): T | undefined {
    let best: T | undefined;
    let bestNamed = -1;
    for (const record of records) {
        const named = Object.entries(record.values);
        const matches = named.every(([id, value]) => selection[id] === value);
        if (matches && named.length > bestNamed) {
            best = record;
            bestNamed = named.length;
        }
    }
    return best;
}

/**
 * A value as a person reads it: a quantity evaluated, in the unit its parameter
 * declares, and a checkbox as its state. An enum's value is its option id,
 * which only its own options can name, so the caller holding them spells that.
 */
export function formatValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    if (parameter.type === ParameterType.BOOLEAN) {
        // Anything else was not written by `toSelection`, so it rides as
        // stored rather than being read as a "No".
        if (value === "true") return "Yes";
        if (value === "false") return "No";
        return value;
    }
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
