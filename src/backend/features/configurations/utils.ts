import {
    type ConfigurationKey,
    type ConfigurationRecord,
    type PartMetadata,
    type PartialSelection,
    Selection,
    DEFAULT_CONFIGURATION_KEY,
    EnumOption,
    EnumParameter,
    OptionVisibilityCondition,
    OptionVisibilityType,
    ConfigurationParameter,
    ParameterType,
    QuantityParameter,
    SearchRecord,
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

/**
 * The record a selection produces. Several can match, since records name only
 * enumerated parameters, so the most specific wins.
 */
export function findRecordForConfiguration(
    configurationKey: ConfigurationKey,
    records: SearchRecord[]
): SearchRecord | undefined {
    const selected = new Set(splitConfiguration(configurationKey));
    let best: SearchRecord | undefined;
    let bestNamed = -1;
    for (const record of records) {
        const named = splitConfiguration(record.configurationKey);
        const matches = named.every((assignment) => selected.has(assignment));
        if (matches && named.length > bestNamed) {
            best = record;
            bestNamed = named.length;
        }
    }
    return best;
}

/**
 * Whether a parameter is shown. Takes a partial selection: visibility is what
 * enumeration consults while a combination is still being built up.
 */
export function evaluateCondition(
    condition: VisibilityCondition | undefined,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): boolean {
    if (!condition) {
        return true;
    }

    if (condition.type === VisibilityType.LOGICAL) {
        // An OR of no children reads as false, which would hide a parameter
        // over a condition the parser merely failed to represent.
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

/** A description holding a link is the link, rather than a description. */
const ABSOLUTE_URL = new RegExp("^https?://", "i");

/**
 * The page for a part, in descending precision: a description that is already a
 * url, then the vendor the part number names, then the taggings standing in.
 */
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
 * The text form of a configuration: `id=value;id=value`, values percent-encoded
 * so a `;` or `=` typed into a string parameter cannot read as the end of the
 * assignment. {@link decodeConfiguration} is the other half, and `utils.test.ts`
 * pins the round trip.
 *
 * This is the form a key is stored and addressed by, and the form a request body
 * carries, where nothing escapes it a second time. A query parameter is escaped
 * again in transport, so it takes {@link encodeQueryConfiguration} instead.
 */
export function encodeConfiguration(configuration?: Selection): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${encodeURIComponent(value)}`)
        .join(";");
}

/** What `escapeForQuery` replaces, being what the text form is structured by. */
const QUERY_ESCAPES: Record<string, string> = {
    "%": "%25",
    ";": "%3B",
    "=": "%3D"
};

function escapeForQuery(value: string): string {
    return value.replace(/[%;=]/g, (character) => QUERY_ESCAPES[character]);
}

/**
 * The form Onshape's `configuration` query parameter takes: the same
 * assignments, with only the three structural characters escaped.
 *
 * Putting it in a query escapes it once more — `URLSearchParams` for our own
 * calls, `encodeURIComponent` for a document url — and Onshape's examples show
 * a quantity arriving with exactly that one layer: `dia1=1+m`, `theta=2+degree`.
 * A value percent-encoded here would reach them with the extra layer intact, so
 * `0.381 m` would be read as the literal `0.381%20m`, which is no quantity.
 *
 * Escaping the structural three still keeps a typed `;` from ending an
 * assignment, and `decodeConfiguration` reads this form back as well.
 */
export function encodeQueryConfiguration(configuration?: Selection): string {
    if (!configuration) {
        return "";
    }
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${escapeForQuery(value)}`)
        .join(";");
}

/** The same, for a configuration already encoded as a key. */
export function toQueryConfiguration(configurationKey: string): string {
    return encodeQueryConfiguration(decodeConfiguration(configurationKey));
}

/** The assignments a configuration text names, each still `id=value`. */
function splitConfiguration(configuration: string): string[] {
    return configuration.split(";").filter((assignment) => assignment !== "");
}

/**
 * The values a configuration text names. A key names only what it overrides, so
 * what it omits is the parameter's own default — `fromKey` fills those in.
 */
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

/**
 * The enum options the selection leaves visible, by the parameter's own option
 * conditions. Partial for the same reason {@link evaluateCondition} is.
 */
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
 * The options an enum currently offers. A condition restricts the options it
 * names and says nothing about the rest, so an option no condition names is
 * always offered, and one several name is offered while any of them holds.
 * Offering only what a passing condition names instead empties a
 * partly-conditioned enum, and the panel drops a parameter with no options.
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
    return [
        { ...partMetadata, configurationKey: DEFAULT_CONFIGURATION_KEY },
        ...records
    ];
}
