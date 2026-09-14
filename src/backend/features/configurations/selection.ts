/**
 * The two forms a configuration takes, and the only place either is built.
 * Canonicalizing is lossy: "2 + 3 in" survives only in the input it was typed into.
 */
import {
    type ConfigurationKey,
    type ConfigurationParameter,
    ParameterType,
    type PartialSelection,
    type QuantityParameter,
    type Selection
} from "./contract";
import {
    DEFAULT_QUANTITY_PRECISION,
    decodeConfiguration,
    encodeConfiguration,
    evaluateCondition
} from "./utils";
import {
    evaluateBaseValue,
    formatBaseValue,
    formatValueInUnit,
    formatValueWithUnits
} from "./input-parser";

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
    values: PartialSelection,
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

/** What a selection changes from the element's own defaults, and nothing else. */
function overriddenValues(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const values = appliedValues(selection, parameters);
    const overrides: Selection = {};
    for (const parameter of parameters) {
        const value = values[parameter.id];
        if (value !== undefined && value !== parameter.default) {
            overrides[parameter.id] = value;
        }
    }
    return overrides;
}

/**
 * A selection's identity: what it overrides, encoded. Two selections that
 * render the same thing key the same, and so share a cache entry.
 */
export function toKey(
    selection: Selection,
    parameters: ConfigurationParameter[]
): ConfigurationKey {
    return encodeConfiguration(overriddenValues(selection, parameters));
}

/**
 * Values encoded the way Onshape is told them, quantities in their own unit.
 * Never a key and never stored as one: a key is an identity, so it stays in
 * base units where two equal values spell alike, while this is only ever read
 * by Onshape, which would rather be told "1.5 in".
 */
function encodeForOnshape(
    values: Selection,
    parameters: ConfigurationParameter[]
): string {
    const spelled: Selection = {};
    for (const parameter of parameters) {
        const value = values[parameter.id];
        if (value === undefined) {
            continue;
        }
        spelled[parameter.id] =
            parameter.type === ParameterType.QUANTITY
                ? toExpression(parameter, value)
                : value;
    }
    return encodeConfiguration(spelled);
}

/** The overrides an insert hands Onshape: the short form, empty for defaults. */
export function toOnshapeConfiguration(
    selection: Selection,
    parameters: ConfigurationParameter[]
): string {
    return encodeForOnshape(
        overriddenValues(selection, parameters),
        parameters
    );
}

/**
 * The shortest configuration that is not empty: the first parameter the
 * selection applies, at the value it applies. Onshape fills the rest in from the
 * element's own defaults, so it names the same render "" does — for a caller
 * that must hand Onshape a configuration but cannot hand it "".
 *
 * Itself empty only when a condition hides every parameter the element has.
 */
export function toShortestConfiguration(
    selection: Selection,
    parameters: ConfigurationParameter[]
): string {
    const values = appliedValues(selection, parameters);
    const first = parameters.find(
        (parameter) => values[parameter.id] !== undefined
    );
    return first === undefined ? "" : encodeForOnshape(values, [first]);
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

/**
 * What Onshape is handed for a quantity: the parameter's own unit, so a derived
 * feature reads "1.5 in" rather than the "0.0381 meter" a selection stores.
 * Both name the same value — this is the one a person recognizes as theirs.
 *
 * Not the expression that was typed: that lives in the input and nowhere else,
 * so "2 + 3 in" arrives here as "5 in". Unlike {@link formatValue} it keeps
 * every decimal, being the value Onshape builds from rather than a label.
 */
export function toExpression(
    parameter: QuantityParameter,
    value: string
): string {
    const base = evaluateBaseValue(
        value,
        parameter.quantityType,
        parameter.unit
    );
    return base === undefined ? value : formatValueInUnit(base, parameter.unit);
}
