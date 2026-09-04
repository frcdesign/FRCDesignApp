import {
    type ConfigurationRecord,
    type PartMetadata,
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
} from "./models";
import {
    Vendor,
    getVendorPartUrl,
    parseVendor,
    parseVendorFromPartNumber
} from "../library/vendors";
import { LogicalOp, QuantityType, Unit } from "./enums";
import { type EvaluateOptions, valueWithUnits } from "./input-parser";

/**
 * The record a selection produces. Records name only enumerated parameters, so
 * several can match; the most specific (the most named) wins. Both sides are
 * canonical and built in parameter order, so this compares whole assignments.
 */
export function findRecordForConfiguration(
    canonicalConfiguration: string,
    records: SearchRecord[]
): SearchRecord | undefined {
    const selected = new Set(splitConfiguration(canonicalConfiguration));
    let best: SearchRecord | undefined;
    let bestNamed = -1;
    for (const record of records) {
        const named = splitConfiguration(record.canonicalConfiguration);
        const matches = named.every((assignment) => selected.has(assignment));
        if (matches && named.length > bestNamed) {
            best = record;
            bestNamed = named.length;
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
/**
 * The page for a part, in descending precision: a description that is already a
 * url, then the vendor the part number names, then the taggings standing in.
 */
/** A description holding a link is the link, rather than a description. */
const ABSOLUTE_URL = new RegExp("^https?://", "i");

export function getPartUrl(
    record: PartMetadata,
    vendors: Vendor[] = []
): string | undefined {
    if (record.description && ABSOLUTE_URL.test(record.description)) {
        return record.description;
    }
    // WCP-123 -> WCP, then what the part says it is, then the insertable's
    // tagging when it names one vendor and one only.
    let vendor = parseVendorFromPartNumber(record.partNumber);
    vendor ??= parseVendor(record.vendor);
    if (!vendor && vendors.length === 1) {
        vendor = vendors[0];
    }
    return getVendorPartUrl(vendor, record.partNumber);
}

/**
 * The text form of a configuration, which is Onshape's own: `id=value;id=value`.
 * Values never carry a `;` or an `=`, which is what lets this round-trip.
 */
export function encodeConfiguration(configuration?: ParameterValues): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${value}`)
        .join(";");
}

/** The assignments a configuration text names, each still `id=value`. */
export function splitConfiguration(configuration: string): string[] {
    return configuration.split(";").filter((assignment) => assignment !== "");
}

/**
 * The values a configuration text names. A canonical one names only what it
 * overrides, so what it omits is the parameter's own default.
 */
export function decodeConfiguration(configuration: string): ParameterValues {
    const values: ParameterValues = {};
    for (const assignment of splitConfiguration(configuration)) {
        const separator = assignment.indexOf("=");
        if (separator > 0) {
            values[assignment.slice(0, separator)] = assignment.slice(
                separator + 1
            );
        }
    }
    return values;
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

/**
 * An insertable's full record list: its own part data first — the record an
 * unset configuration falls back to — then one per indexed configuration.
 */
export function toRecords(
    partMetadata: PartMetadata | null,
    records: ConfigurationRecord[]
): ConfigurationRecord[] {
    if (!partMetadata) return records;
    return [{ ...partMetadata, canonicalConfiguration: "" }, ...records];
}
