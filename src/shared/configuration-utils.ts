import {
    ParameterValues,
    EnumOption,
    EnumParameter,
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    QuantityParameter,
    SearchRecord,
    UnitInfo,
    VisibilityCondition,
    VisibilityType
} from "./configuration-models";
import { LogicalOp, QuantityType, Unit } from "./configuration-enums";
import {
    type EvaluateOptions,
    evaluateExpression,
    valueWithUnits
} from "./input-parser";

/**
 * Finds the record a (full) configuration selection produces. Records are keyed
 * only by the enumerated parameters (enum/boolean, non-cosmetic — see
 * `enumerateConfigurations`), so a record matches when every value in its
 * `configuration` equals the user's selection for that key. When several match
 * (a parameter hidden in some configs yields shorter key-sets), the most
 * specific — the record with the most keys — wins.
 */
export function findRecordForConfiguration(
    configuration: ParameterValues,
    records: SearchRecord[]
): SearchRecord | undefined {
    let best: SearchRecord | undefined;
    let bestKeys = -1;
    for (const record of records) {
        const keys = Object.keys(record.configuration);
        const matches = keys.every(
            (key) => configuration[key] === record.configuration[key]
        );
        if (matches && keys.length > bestKeys) {
            best = record;
            bestKeys = keys.length;
        }
    }
    return best;
}

export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    configuration: Record<string, string>,
    parameters: ConfigurationParameter[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type == VisibilityType.LOGICAL) {
        if (condition.operation == LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        } else {
            return condition.children.some((child) =>
                evaluateCondition(child, configuration, parameters)
            );
        }
    } else if (condition.type == VisibilityType.EQUAL) {
        return condition.value == configuration[condition.id];
    } else if (condition.type == VisibilityType.RANGE) {
        const parameter = parameters.find(
            (parameter) => parameter.id === condition.id
        );
        if (parameter?.type != ParameterType.ENUM) {
            throw new Error(
                "Visibility condition does not target a valid enum parameter."
            );
        }

        const optionIds = parameter.options.map((option) => option.id);
        const startIndex = optionIds.indexOf(condition.start);
        const endIndex = optionIds.indexOf(condition.end);
        return optionIds
            .slice(startIndex, endIndex + 1)
            .includes(configuration[condition.id]);
    } else if (condition.type === VisibilityType.ALWAYS_SHOWN) {
        return true;
    }
    return true;
}
export function encodeConfigurationForQuery(
    configuration?: ParameterValues
): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

export function getOption(
    options: EnumOption[],
    optionId: string
): EnumOption | undefined {
    return options.find((option) => option.id == optionId);
}

/**
 * Returns the enum options visible given the current (possibly partial)
 * configuration, applying the parameter's option visibility conditions.
 */
export function getVisibleOptions(
    enumParameter: EnumParameter,
    configuration: ParameterValues,
    parameters: ConfigurationParameter[]
): EnumOption[] {
    // No conditions means everything is shown
    if (enumParameter.optionConditions.length === 0) {
        return enumParameter.options;
    }

    const optionIds = enumParameter.options.map((option) => option.id);

    const validOptionIds = enumParameter.optionConditions
        .filter((optionCondition) =>
            evaluateCondition(
                optionCondition.condition,
                configuration,
                parameters
            )
        )
        .flatMap((optionCondition) => {
            if (optionCondition.type == OptionVisibilityType.LIST) {
                return optionCondition.controlledOptions;
            } else if (optionCondition.type == OptionVisibilityType.RANGE) {
                return optionIds.slice(
                    optionIds.indexOf(optionCondition.start),
                    optionIds.indexOf(optionCondition.end) + 1
                );
            }
            throw new Error("Unhandled option condition type");
        });

    const validOptionsSet = new Set(validOptionIds);
    return enumParameter.options.filter((option) =>
        validOptionsSet.has(option.id)
    );
}

/** Display precision used when the document's units aren't available. */
const DEFAULT_QUANTITY_PRECISION = 3;

/**
 * The evaluation settings for a quantity parameter: its own bounds, plus the
 * document's display unit and precision, falling back to the parameter's own.
 */
export function getEvaluateOptions(
    parameter: QuantityParameter,
    unitInfo: UnitInfo
): EvaluateOptions {
    const quantityType = parameter.quantityType;
    const minAndMax = {
        min: valueWithUnits(parameter.min, parameter.unit),
        max: valueWithUnits(parameter.max, parameter.unit)
    };
    if (quantityType === QuantityType.LENGTH) {
        return {
            quantityType,
            displayPrecision:
                unitInfo.lengthPrecision ?? DEFAULT_QUANTITY_PRECISION,
            displayUnit: unitInfo.lengthUnit ?? parameter.unit,
            ...minAndMax
        };
    } else if (quantityType === QuantityType.ANGLE) {
        return {
            quantityType,
            displayPrecision:
                unitInfo.anglePrecision ?? DEFAULT_QUANTITY_PRECISION,
            displayUnit: unitInfo.angleUnit ?? parameter.unit,
            ...minAndMax
        };
    } else if (quantityType === QuantityType.REAL) {
        return {
            quantityType,
            displayPrecision:
                unitInfo.realPrecision ?? DEFAULT_QUANTITY_PRECISION,
            displayUnit: Unit.UNITLESS,
            ...minAndMax
        };
    }
    return {
        quantityType: QuantityType.INTEGER,
        displayPrecision: 0,
        displayUnit: Unit.UNITLESS,
        ...minAndMax
    };
}

/** Normalizes one parameter's raw value to its canonical spelling. */
function canonicalizeValue(
    parameter: ConfigurationParameter,
    value: string,
    unitInfo?: UnitInfo
): string {
    if (parameter.type === ParameterType.QUANTITY && unitInfo) {
        // "1in", "1 in", and "(0.5 + 0.5) in" are the same configuration; the
        // evaluated, rounded display form is the one spelling of it. An
        // unparseable value can't be normalized, so it rides as-is.
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
 * Reduces a configuration to the one spelling shared by every selection that
 * renders the same thing, so thumbnails of equivalent configurations resolve to
 * a single cache entry.
 *
 * Parameters are emitted in declaration order (object key order is not
 * meaningful); values are normalized per type; parameters hidden by a
 * visibility condition are dropped, as are values matching the parameter's
 * default — Onshape applies the default for anything omitted, so an
 * all-defaults selection canonicalizes to `{}`, which is the default thumbnail.
 *
 * `unitInfo` is only needed to evaluate quantity expressions; omit it where the
 * configuration can't contain them (enumerated records hold enum and boolean
 * values only), and those values ride through trimmed.
 */
export function canonicalizeConfiguration(
    configuration: ParameterValues,
    parameters: ConfigurationParameter[],
    unitInfo?: UnitInfo
): ParameterValues {
    const canonical: ParameterValues = {};
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
        canonical[parameter.id] = canonicalValue;
    }
    return canonical;
}

/** The canonical configuration as one string; empty means the element default. */
export function encodeCanonicalConfiguration(
    canonical: ParameterValues
): string {
    return Object.entries(canonical)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

/**
 * A short, stable key for a canonical configuration, used in thumbnail URLs and
 * R2 keys — a configuration string is unbounded and holds arbitrary characters.
 * Not a security boundary: it only has to avoid collisions within one element,
 * so a fast 53-bit hash is plenty (and, unlike SubtleCrypto, is synchronous).
 */
export function configurationKey(canonical: ParameterValues): string {
    return configurationKeyFor(encodeCanonicalConfiguration(canonical));
}

/** {@link configurationKey}, for an already-encoded canonical configuration. */
export function configurationKeyFor(encoded: string): string {
    if (encoded === "") {
        return DEFAULT_CONFIGURATION_KEY;
    }
    // cyrb53
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < encoded.length; i++) {
        const ch = encoded.charCodeAt(i);
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

/** The key for an element's default configuration (what everything falls back to). */
export const DEFAULT_CONFIGURATION_KEY = "default";
