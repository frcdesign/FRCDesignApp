/**
 * Builds the two forms of a configuration: a selection, as entered, and the
 * key derived from it to name a thumbnail. See AGENTS.md.
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
import { isDerivationVariable } from "./roles";
import {
    DEFAULT_QUANTITY_PRECISION,
    encodeConfiguration,
    evaluateCondition,
    getVisibleOptions,
    resolveSelectedOption
} from "./utils";
import {
    evaluateBaseValue,
    formatBaseValue,
    formatValueWithUnits
} from "./input-parser";

/** A quantity's default in the parameter's own unit, e.g. "1 in". */
export function quantityDefault(
    parameter: Pick<QuantityParameter, "defaultValue" | "unit">
): string {
    const abbreviation = getUnitDisplayStr(parameter.unit);
    const value = String(parameter.defaultValue);
    return abbreviation ? `${value} ${abbreviation}` : value;
}

/**
 * Every declared parameter, as entered, with missing ones defaulted. Checkboxes
 * are normalized to Onshape's spelling and quantities trimmed.
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

/** Drops parameters hidden by a condition, which Onshape never applies. */
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

/** Quantities in base units, so "1in", "1 in" and "25.4 mm" agree. */
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
 * Applied values, canonically spelled, for comparing and counting. Derivation
 * variables are left out since each insert's is unique.
 */
export function canonicalValues(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const applied = appliedValues(selection, parameters);
    const values: Selection = {};
    for (const parameter of parameters) {
        const value = applied[parameter.id];
        if (value !== undefined && !isDerivationVariable(parameter)) {
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

/** The values that differ from the element's defaults, as entered. */
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
 * Selections that render the same part get the same key, so derivation
 * variables are left out.
 */
export function toKey(
    selection: Selection,
    parameters: ConfigurationParameter[]
): ConfigurationKey {
    const overrides = onshapeOverrides(selection, parameters);
    const canonical: Selection = {};
    for (const parameter of parameters) {
        const value = overrides[parameter.id];
        if (value !== undefined && !isDerivationVariable(parameter)) {
            canonical[parameter.id] = canonicalValue(parameter, value);
        }
    }
    return encodeConfiguration(canonical);
}

/**
 * Gives each derivation variable a fresh value: Onshape refuses a second derive
 * of the same part in the same configuration. `keepFilled` keeps existing ones
 * so the panel doesn't show a new value every render.
 */
export function withDerivationValues(
    selection: Selection,
    parameters: ConfigurationParameter[],
    keepFilled = false
): Selection {
    const next = { ...selection };
    for (const parameter of parameters) {
        if (!isDerivationVariable(parameter)) {
            continue;
        }
        const filled = next[parameter.id] !== parameter.default;
        if (!(keepFilled && filled)) {
            next[parameter.id] = crypto.randomUUID();
        }
    }
    return next;
}

/** Strips derivation variables before a selection is stored or shared. */
export function toStoredSelection(
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): PartialSelection {
    const stored = { ...selection };
    for (const parameter of parameters) {
        if (isDerivationVariable(parameter)) {
            delete stored[parameter.id];
        }
    }
    return stored;
}

/**
 * The first applied parameter alone. Onshape fills in the rest from defaults,
 * so this names the default part for callers that can't send an empty
 * configuration. Empty only when every parameter is hidden.
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
 * Records name only what enumeration varied, so several can match; the most
 * specific wins.
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
 * Enums are left as their option id, which the caller spells from the options
 * it holds.
 */
export function formatValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    if (parameter.type === ParameterType.BOOLEAN) {
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

/** One pass: hidden parameters take their default, enums the option they land on. */
function normalizeOnce(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const next = { ...selection };
    for (const parameter of parameters) {
        if (!evaluateCondition(parameter.condition, next, parameters)) {
            next[parameter.id] = parameter.default;
            continue;
        }
        if (parameter.type !== ParameterType.ENUM) {
            continue;
        }
        const visible = getVisibleOptions(parameter, next, parameters);
        next[parameter.id] =
            resolveSelectedOption(
                visible,
                next[parameter.id],
                parameter.default
            )?.id ?? parameter.default;
    }
    return next;
}

export function sameSelection(
    a: PartialSelection | undefined,
    b: Selection
): boolean {
    if (!a) return false;
    const keys = Object.keys(b);
    return (
        keys.length === Object.keys(a).length &&
        keys.every((key) => a[key] === b[key])
    );
}

/**
 * Repeated because settling one parameter can change another's options. The
 * pass cap stops parameters whose conditions name each other, so the result
 * isn't always a fixed point.
 */
export function normalizeSelection(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    let current = selection;
    for (let pass = 0; pass <= parameters.length; pass++) {
        const next = normalizeOnce(current, parameters);
        if (sameSelection(current, next)) {
            return current;
        }
        current = next;
    }
    return current;
}
