import {
    type ConfigurationParameter,
    type EnumOption,
    ParameterType,
    type PartialSelection,
    type Selection
} from "@backend/features/configurations/contract";
import {
    evaluateCondition,
    getOption,
    getVisibleOptions
} from "@backend/features/configurations/utils";

/** Returns the same selection when nothing changes, so React can bail out. */
export function withParameterValue(
    selection: Selection,
    parameter: ConfigurationParameter,
    newValue: string | undefined
): Selection {
    const wanted = newValue ?? parameter.default;
    if (selection[parameter.id] === wanted) {
        return selection;
    }
    return { ...selection, [parameter.id]: wanted };
}

/** The selected option if still visible, else the default, else the first. */
export function resolveSelectedOption(
    visibleOptions: EnumOption[],
    currentOptionId: string | undefined,
    defaultOptionId: string
): EnumOption | undefined {
    if (visibleOptions.length === 0) {
        return undefined;
    }
    return (
        (currentOptionId
            ? getOption(visibleOptions, currentOptionId)
            : undefined) ??
        getOption(visibleOptions, defaultOptionId) ??
        visibleOptions[0]
    );
}

/** One pass: hidden parameters take their default, enums the option they land on. */
function normalizeOnce(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    const next = { ...selection };
    for (const parameter of parameters) {
        if (!evaluateCondition(parameter.condition, next, parameters)) {
            next[parameter.id] = parameter.default;
            continue;
        }
        if (parameter.type !== ParameterType.ENUM) {
            continue;
        }
        const visible = getVisibleOptions(parameter, next, parameters);
        next[parameter.id] =
            resolveSelectedOption(
                visible,
                next[parameter.id],
                parameter.default
            )?.id ?? parameter.default;
    }
    return next;
}

export function sameSelection(
    a: PartialSelection | undefined,
    b: Selection
): boolean {
    if (!a) return false;
    const keys = Object.keys(b);
    return (
        keys.length === Object.keys(a).length &&
        keys.every((key) => a[key] === b[key])
    );
}

/**
 * Repeated because settling one parameter can change another's options. The
 * pass cap stops parameters whose conditions name each other, so the result
 * isn't always a fixed point.
 */
export function normalizeSelection(
    selection: Selection,
    parameters: ConfigurationParameter[]
): Selection {
    let current = selection;
    for (let pass = 0; pass <= parameters.length; pass++) {
        const next = normalizeOnce(current, parameters);
        if (sameSelection(current, next)) {
            return current;
        }
        current = next;
    }
    return current;
}
