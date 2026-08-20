/**
 * A `canonicalConfiguration` addresses a render — thumbnails, R2 keys, search
 * records. Only insert/derive needs the user's literal `configuration`.
 */
import {
    type ConfigurationParameter,
    ParameterType,
    type ParameterValues
} from "./configuration-models";
import { QuantityType, Unit, getUnitDisplayStr } from "./configuration-enums";
import { evaluateCondition } from "./configuration-utils";
import { evaluateBaseValue } from "./input-parser";

/** The element default, which is what an empty canonical configuration encodes. */
export const DEFAULT_CANONICAL_CONFIGURATION = "";

/** The key for an element's default configuration (what everything falls back to). */
export const DEFAULT_CONFIGURATION_KEY = "default";

/** Decimals kept on a base-unit value: 0.1 µm, past any real CAD tolerance. */
const BASE_UNIT_PRECISION = 7;

/** Base units, so the spelling never depends on the document's display units. */
function baseUnit(quantityType: QuantityType): Unit {
    if (quantityType === QuantityType.LENGTH) return Unit.METER;
    if (quantityType === QuantityType.ANGLE) return Unit.RADIAN;
    return Unit.UNITLESS;
}

/** Normalizes one parameter's raw value to its canonical spelling. */
function canonicalizeValue(
    parameter: ConfigurationParameter,
    value: string
): string {
    if (parameter.type === ParameterType.QUANTITY) {
        // "1in", "1 in", "(0.5 + 0.5) in" and "25.4 mm" are one configuration.
        // Unparseable values ride as-is.
        const base = evaluateBaseValue(
            value,
            parameter.quantityType,
            parameter.unit
        );
        if (base === undefined) {
            return value.trim();
        }
        const unit = baseUnit(parameter.quantityType);
        const rounded = Number(base.toFixed(BASE_UNIT_PRECISION));
        const suffix = getUnitDisplayStr(unit);
        return suffix ? `${rounded} ${suffix}` : `${rounded}`;
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
    parameters: ConfigurationParameter[]
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
        const canonicalValue = canonicalizeValue(parameter, value);
        const canonicalDefault = canonicalizeValue(
            parameter,
            parameter.default
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
