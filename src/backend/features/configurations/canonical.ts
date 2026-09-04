/**
 * A `configuration` is the selection a user made, and is what insert and derive
 * send to Onshape. A `canonicalConfiguration` is the one text spelling every
 * equivalent selection shares, and is the only form that addresses a render —
 * thumbnails, R2 keys, stored records. It is always text; nothing holds a
 * half-canonical map.
 *
 * Canonicalizing is lossy — "2 + 3 in" evaluates away — so anything that hands
 * a selection back to the user stores the configuration and derives this.
 */
import {
    type ConfigurationParameter,
    ParameterType,
    type ParameterValues
} from "./models";
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

/** The element default, which is what a canonical configuration overriding nothing is. */
export const DEFAULT_CANONICAL_CONFIGURATION = "";

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
 * Every value the selection actually applies, canonically spelled.
 *
 * Onshape doesn't apply a hidden parameter, so one that its condition rules out
 * is left off — it changes neither the render nor what the user chose. Defaults
 * stay: a render is the same whether a value was picked or defaulted, but a
 * record of what people pick is not.
 *
 * In parameter order, so equivalent selections come out spelled the same way.
 */
export function canonicalizeValues(
    configuration: ParameterValues,
    parameters: ConfigurationParameter[]
): ParameterValues {
    const values: ParameterValues = {};
    for (const parameter of parameters) {
        const value = configuration[parameter.id];
        if (value === undefined) {
            continue;
        }
        if (
            !evaluateCondition(parameter.condition, configuration, parameters)
        ) {
            continue;
        }
        values[parameter.id] = canonicalizeValue(parameter, value);
    }
    return values;
}

/**
 * Reduces a configuration to the one spelling every equivalent selection shares,
 * so their thumbnails resolve to one cache entry. Drops defaults on top of
 * {@link canonicalizeValues}, and so names only what a selection overrides.
 */
export function canonicalizeConfiguration(
    configuration: ParameterValues,
    parameters: ConfigurationParameter[]
): string {
    const values = canonicalizeValues(configuration, parameters);
    const overrides: ParameterValues = {};
    for (const parameter of parameters) {
        const value = values[parameter.id];
        if (
            value === undefined ||
            value === canonicalizeValue(parameter, parameter.default)
        ) {
            continue;
        }
        overrides[parameter.id] = value;
    }
    return encodeConfiguration(overrides);
}

/**
 * A canonical value spelled for a reader: a quantity in the unit its parameter
 * declares, rather than the base unit it is keyed in. Everything else already
 * reads as it is stored.
 */
export function formatCanonicalValue(
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
