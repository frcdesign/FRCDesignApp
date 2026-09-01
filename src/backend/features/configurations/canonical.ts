/**
 * A `configuration` is the selection a user made, and is what insert and derive
 * send to Onshape. A `canonicalConfiguration` is the one text spelling every
 * equivalent selection shares, and is the only form that addresses a render —
 * thumbnails, R2 keys, stored records. It is always text; nothing holds a
 * half-canonical map.
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

/** The key for an element's default configuration (what everything falls back to). */
export const DEFAULT_CONFIGURATION_KEY = "default";

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

/**
 * A short, stable key for an R2 key, since a configuration is unbounded. It only
 * has to avoid collisions within one element, so a truncated digest is plenty.
 */
export async function toConfigurationKey(
    canonicalConfiguration: string
): Promise<string> {
    if (canonicalConfiguration === DEFAULT_CANONICAL_CONFIGURATION) {
        return DEFAULT_CONFIGURATION_KEY;
    }
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalConfiguration)
    );
    return [...new Uint8Array(digest, 0, 8)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
