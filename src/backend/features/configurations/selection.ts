/**
 * Builds the two forms of a configuration: a selection, its quantities
 * collapsed, and the key derived from it to name a thumbnail. See AGENTS.md.
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
    formatValueInUnit,
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
 * Every declared parameter, with missing ones defaulted. Checkboxes are
 * normalized to Onshape's spelling and quantities collapsed (`collapseQuantity`).
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
            selection[parameter.id] = collapseQuantity(parameter, value.trim());
        } else {
            selection[parameter.id] = value;
        }
    }
    return selection;
}

/**
 * A quantity as its value in the parameter's own unit, to the precision values
 * are compared at: `(2 + 3) in` is `5 in`, and `1/3 in` keeps every digit that
 * tells it apart. Left as given when it doesn't evaluate, so the input can say why.
 */
function collapseQuantity(parameter: QuantityParameter, value: string): string {
    const base = evaluateBaseValue(
        value,
        parameter.quantityType,
        parameter.unit
    );
    return base === undefined ? value : formatValueInUnit(base, parameter.unit);
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

/** The values that differ from the element's defaults. */
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
 * A Part Studio's overrides as an insert sends them. Onshape won't insert a
 * Part Studio from an empty configuration, so at the defaults the first
 * parameter is named at its default.
 */
export function partStudioInsertOverrides(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const overrides = onshapeOverrides(selection, parameters);
    const [first] = parameters;
    if (Object.keys(overrides).length > 0 || !first) {
        return overrides;
    }
    return { [first.id]: selection[first.id] };
}

/**
 * What a render sends Onshape: the selection's values, never the key's base
 * units, since Onshape names its renders by the value it computes, which
 * differs in the last bit between `2.25 in` and `0.05715 m`. Derivation
 * variables are left out, since each insert's is unique.
 */
export function renderOverrides(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const overrides = onshapeOverrides(selection, parameters);
    const values: Selection = {};
    for (const parameter of parameters) {
        const value = overrides[parameter.id];
        if (value !== undefined && !isDerivationVariable(parameter)) {
            values[parameter.id] = value;
        }
    }
    return values;
}

/** Selections that render the same part get the same key. */
export function toKey(
    selection: Selection,
    parameters: ConfigurationParameter[]
): ConfigurationKey {
    const overrides = renderOverrides(selection, parameters);
    const canonical: Selection = {};
    for (const parameter of parameters) {
        const value = overrides[parameter.id];
        if (value !== undefined) {
            canonical[parameter.id] = canonicalValue(parameter, value);
        }
    }
    return encodeConfiguration(canonical);
}

/** Gives each derivation variable still at its default a unique value, so each derive is its own configuration. */
export function fillDerivationValues(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const next = { ...selection };
    for (const parameter of parameters) {
        if (
            isDerivationVariable(parameter) &&
            next[parameter.id] === parameter.default
        ) {
            next[parameter.id] = crypto.randomUUID();
        }
    }
    return next;
}

/** The values a partial selection names, for a place that holds a `Selection` without the parameters to fill it. */
export function namedValues(selection: PartialSelection): Selection {
    return Object.fromEntries(
        Object.entries(selection).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
        )
    );
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

/** One parameter of a configuration, spelled for reading. */
export interface DisplayedValue {
    parameter: ConfigurationParameter;
    /** An enum's option name, a checkbox's Yes or No, a quantity in its own unit. */
    value: string;
    isDefault: boolean;
}

/**
 * What a selection applies, as the insert menu would settle it, in declaration
 * order. Hidden parameters and derivation variables are left out.
 */
export function displayedValues(
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): DisplayedValue[] {
    const applied = appliedValues(
        normalizeSelection(toSelection(selection, parameters), parameters),
        parameters
    );
    return parameters.flatMap((parameter) => {
        const value = applied[parameter.id];
        if (value === undefined || isDerivationVariable(parameter)) {
            return [];
        }
        return [
            {
                parameter,
                value: displayValue(parameter, value),
                isDefault: isDefault(parameter, value)
            }
        ];
    });
}

function displayValue(parameter: ConfigurationParameter, value: string) {
    if (parameter.type === ParameterType.ENUM) {
        return (
            parameter.options.find((option) => option.id === value)?.name ??
            value
        );
    }
    return formatValue(parameter, value);
}

/**
 * A selection with `changes` laid over it and settled, for editing a part
 * that's already placed. Undefined when a change doesn't hold once settled:
 * this selection's other values hide the parameter, or the option.
 */
export function applyChanges(
    selection: Selection,
    changes: PartialSelection,
    parameters: ConfigurationParameter[]
): Selection | undefined {
    const changed = toSelection({ ...selection, ...changes }, parameters);
    const settled = normalizeSelection(changed, parameters);
    const applied = appliedValues(settled, parameters);
    const holds = Object.keys(changes).every(
        (id) => applied[id] !== undefined && applied[id] === changed[id]
    );
    return holds ? settled : undefined;
}
