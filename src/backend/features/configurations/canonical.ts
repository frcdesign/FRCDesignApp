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
import { encodeConfiguration, evaluateCondition } from "./utils";
import { evaluateBaseValue, formatBaseValue } from "./input-parser";

/** The element default, which is what a canonical configuration overriding nothing is. */
export const DEFAULT_CANONICAL_CONFIGURATION = "";

/** Normalizes one parameter's raw value to its canonical spelling. */
function canonicalizeValue(
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
 * Reduces a configuration to the one spelling every equivalent selection shares,
 * so their thumbnails resolve to one cache entry. Drops defaults and hidden
 * values, and so names only what a selection actually overrides.
 */
export function canonicalizeConfiguration(
    configuration: ParameterValues,
    parameters: ConfigurationParameter[]
): string {
    const overrides: ParameterValues = {};
    for (const parameter of parameters) {
        const value = configuration[parameter.id];
        if (value === undefined) {
            continue;
        }
        // Onshape doesn't apply a hidden parameter, so it can't change the render.
        if (
            !evaluateCondition(parameter.condition, configuration, parameters)
        ) {
            continue;
        }
        const canonicalValue = canonicalizeValue(parameter, value);
        const canonicalDefault = canonicalizeValue(
            parameter,
            parameter.default
        );
        if (canonicalValue === canonicalDefault) {
            continue;
        }
        overrides[parameter.id] = canonicalValue;
    }
    // Built in parameter order, so equivalent selections spell it the same way.
    return encodeConfiguration(overrides);
}
