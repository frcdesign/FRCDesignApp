import {
    type PartMetadata,
    type PartialSelection,
    Selection,
    EnumOption,
    EnumParameter,
    OptionVisibilityCondition,
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    QuantityParameter,
    UnitInfo,
    VisibilityCondition,
    VisibilityType
} from "./contract";
import {
    Vendor,
    getVendorPartUrl,
    parseVendor,
    parseVendorFromPartNumber
} from "../library/vendors";
import { LogicalOp, QuantityType, Unit } from "./enums";
import { type EvaluateOptions, valueWithUnits } from "./input-parser";

/** Takes a partial selection, since enumeration checks it mid-combination. */
export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type === VisibilityType.LOGICAL) {
        // An empty OR is a condition the parser failed to represent; don't hide over it.
        if (condition.children.length === 0) {
            return true;
        }
        if (condition.operation === LogicalOp.AND) {
            return condition.children.every((child) =>
                evaluateCondition(child, selection, parameters)
            );
        }
        return condition.children.some((child) =>
            evaluateCondition(child, selection, parameters)
        );
    } else if (condition.type === VisibilityType.EQUAL) {
        return condition.value === selection[condition.id];
    } else if (condition.type === VisibilityType.RANGE) {
        const parameter = parameters.find(
            (parameter) => parameter.id === condition.id
        );
        if (parameter?.type !== ParameterType.ENUM) {
            throw new Error(
                "Visibility condition does not target a valid enum parameter."
            );
        }

        const optionIds = parameter.options.map((option) => option.id);
        const startIndex = optionIds.indexOf(condition.start);
        const endIndex = optionIds.indexOf(condition.end);
        const value = selection[condition.id];
        return (
            value !== undefined &&
            optionIds.slice(startIndex, endIndex + 1).includes(value)
        );
    }
    // ALWAYS_SHOWN, and anything Onshape adds that we have not taught it yet.
    return true;
}

const ABSOLUTE_URL = new RegExp("^https?://", "i");

/** A description that is a url, else the vendor's page for the part number, else the tagged vendor's. */
export function getPartUrl(
    record: PartMetadata,
    vendors: Vendor[] = []
): string | undefined {
    if (record.description && ABSOLUTE_URL.test(record.description)) {
        return record.description;
    }
    let vendor = parseVendorFromPartNumber(record.partNumber);
    vendor ??= parseVendor(record.vendor);
    if (!vendor && vendors.length === 1) {
        vendor = vendors[0];
    }
    return getVendorPartUrl(vendor, record.partNumber);
}

/**
 * `id=value;id=value`, percent-encoded so a typed `;` or `=` can't end an
 * assignment. For keys and request bodies; a query parameter uses
 * {@link encodeQueryConfiguration}.
 */
export function encodeConfiguration(configuration?: PartialSelection): string {
    return assignments(configuration)
        .map(([id, value]) => `${id}=${encodeURIComponent(value)}`)
        .join(";");
}

function assignments(configuration?: PartialSelection): [string, string][] {
    return Object.entries(configuration ?? {}).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
    );
}

/** The characters the text form is structured by, which a value must not spell. */
const QUERY_ESCAPES: Record<string, string> = {
    "%": "%25",
    ";": "%3B",
    "=": "%3D"
};

function escapeForQuery(value: string): string {
    return value.replace(/[%;=]/g, (character) => QUERY_ESCAPES[character]);
}

/**
 * Onshape's `configuration` query parameter. Only `;`, `=` and `%` are escaped:
 * the query adds its own layer, and a value encoded twice reaches Onshape as
 * `0.381%20m`, which isn't a quantity.
 */
export function encodeQueryConfiguration(
    configuration?: PartialSelection
): string {
    return assignments(configuration)
        .map(([id, value]) => `${id}=${escapeForQuery(value)}`)
        .join(";");
}

/** The assignments a configuration text names, each still `id=value`. */
function splitConfiguration(configuration: string): string[] {
    return configuration.split(";").filter((assignment) => assignment !== "");
}

/** The values a configuration text names, in either encoding. */
export function decodeConfiguration(configuration: string): Selection {
    const values: Selection = {};
    for (const assignment of splitConfiguration(configuration)) {
        const separator = assignment.indexOf("=");
        if (separator > 0) {
            values[assignment.slice(0, separator)] = decodeURIComponent(
                assignment.slice(separator + 1)
            );
        }
    }
    return values;
}

export function getOption(
    options: EnumOption[],
    optionId: string
): EnumOption | undefined {
    return options.find((option) => option.id === optionId);
}

/** The options one condition controls, listed or spanned. */
function getControlledOptionIds(
    optionCondition: OptionVisibilityCondition,
    optionIds: string[]
): string[] {
    if (optionCondition.type === OptionVisibilityType.LIST) {
        return optionCondition.controlledOptions;
    } else if (optionCondition.type === OptionVisibilityType.RANGE) {
        return optionIds.slice(
            optionIds.indexOf(optionCondition.start),
            optionIds.indexOf(optionCondition.end) + 1
        );
    }
    throw new Error("Unhandled option condition type");
}

/**
 * An option no condition names is always offered; one several name is offered
 * while any holds.
 */
export function getVisibleOptions(
    enumParameter: EnumParameter,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): EnumOption[] {
    // No conditions means everything is shown
    if (enumParameter.optionConditions.length === 0) {
        return enumParameter.options;
    }

    const optionIds = enumParameter.options.map((option) => option.id);
    const controlled = new Set<string>();
    const shown = new Set<string>();

    for (const optionCondition of enumParameter.optionConditions) {
        const holds = evaluateCondition(
            optionCondition.condition,
            selection,
            parameters
        );
        for (const optionId of getControlledOptionIds(
            optionCondition,
            optionIds
        )) {
            controlled.add(optionId);
            if (holds) {
                shown.add(optionId);
            }
        }
    }

    return enumParameter.options.filter(
        (option) => !controlled.has(option.id) || shown.has(option.id)
    );
}

/** Display precision used when the document's units aren't available. */
export const DEFAULT_QUANTITY_PRECISION = 3;

/** Bounds from the parameter; unit and precision from the document, else the parameter. */
export function getEvaluateOptions(
    parameter: QuantityParameter,
    /** The document's; without one, each quantity shows in its own unit. */
    unitInfo: UnitInfo | undefined
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
                unitInfo?.lengthPrecision ?? DEFAULT_QUANTITY_PRECISION,
            displayUnit: unitInfo?.lengthUnit ?? parameter.unit,
            ...minAndMax
        };
    } else if (quantityType === QuantityType.ANGLE) {
        return {
            quantityType,
            displayPrecision:
                unitInfo?.anglePrecision ?? DEFAULT_QUANTITY_PRECISION,
            displayUnit: unitInfo?.angleUnit ?? parameter.unit,
            ...minAndMax
        };
    } else if (quantityType === QuantityType.REAL) {
        return {
            quantityType,
            displayPrecision:
                unitInfo?.realPrecision ?? DEFAULT_QUANTITY_PRECISION,
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
