/**
 * A `canonicalConfiguration` addresses a render — thumbnails, R2 keys, search
 * records. Only insert/derive needs the user's literal `configuration`.
 */
import {
    type ConfigurationParameter,
    ParameterType,
    type ParameterValues,
    type UnitInfo
} from "./configuration-models";
import { evaluateCondition, getEvaluateOptions } from "./configuration-utils";
import { evaluateExpression } from "./input-parser";

/** The element default, which is what an empty canonical configuration encodes. */
export const DEFAULT_CANONICAL_CONFIGURATION = "";

/** The key for an element's default configuration (what everything falls back to). */
export const DEFAULT_CONFIGURATION_KEY = "default";

/** Normalizes one parameter's raw value to its canonical spelling. */
function canonicalizeValue(
    parameter: ConfigurationParameter,
    value: string,
    unitInfo?: UnitInfo
): string {
    if (parameter.type === ParameterType.QUANTITY && unitInfo) {
        // "1in", "1 in", and "(0.5 + 0.5) in" are one configuration; the rounded
        // display form is its single spelling. Unparseable values ride as-is.
        const result = evaluateExpression(
            value,
            getEvaluateOptions(parameter, unitInfo)
        );
        return result.hasError ? value.trim() : result.displayExpression;
    }
    if (parameter.type === ParameterType.BOOLEAN) {
        return value.trim().toLowerCase();
    }
    return value.trim();
}

/**
 * Reduces a configuration to the one spelling every equivalent selection shares,
 * so their thumbnails resolve to one cache entry. Drops defaults and hidden values.
 */
export function canonicalizeConfiguration(
    configuration: ParameterValues,
    parameters: ConfigurationParameter[],
    unitInfo?: UnitInfo
): ParameterValues {
    const canonicalConfiguration: ParameterValues = {};
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
        const canonicalValue = canonicalizeValue(parameter, value, unitInfo);
        const canonicalDefault = canonicalizeValue(
            parameter,
            parameter.default,
            unitInfo
        );
        if (canonicalValue === canonicalDefault) {
            continue;
        }
        canonicalConfiguration[parameter.id] = canonicalValue;
    }
    return canonicalConfiguration;
}

/** Encodes canonical values for a url, an R2 key, or Onshape's `configuration`. */
export function encodeCanonicalConfiguration(
    canonicalConfiguration: ParameterValues
): string {
    return Object.entries(canonicalConfiguration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

/**
 * The inverse of {@link encodeCanonicalConfiguration}. Only the first `=` splits,
 * so a value may hold one; neither side escapes `;`, which no value contains.
 */
export function decodeCanonicalConfiguration(
    canonicalConfiguration: string
): ParameterValues {
    const values: ParameterValues = {};
    if (canonicalConfiguration === DEFAULT_CANONICAL_CONFIGURATION) {
        return values;
    }
    for (const entry of canonicalConfiguration.split(";")) {
        const separator = entry.indexOf("=");
        if (separator !== -1) {
            values[entry.slice(0, separator)] = entry.slice(separator + 1);
        }
    }
    return values;
}

/**
 * A short, stable key for a url or R2 key, since a configuration is unbounded.
 * Only avoids collisions within one element, so a fast sync hash is plenty.
 */
export function canonicalConfigurationKey(
    canonicalConfiguration: string
): string {
    if (canonicalConfiguration === DEFAULT_CANONICAL_CONFIGURATION) {
        return DEFAULT_CONFIGURATION_KEY;
    }
    // cyrb53
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < canonicalConfiguration.length; i++) {
        const ch = canonicalConfiguration.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return hash.toString(36);
}
