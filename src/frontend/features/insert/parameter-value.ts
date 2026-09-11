import {
    type ConfigurationParameter,
    type EnumOption,
    ParameterType,
    type Selection
} from "@backend/features/configurations/contract";
import {
    evaluateCondition,
    getOption,
    getVisibleOptions
} from "@backend/features/configurations/utils";

/**
 * The selection a row's change produces, or the same one when nothing moves,
 * which is what lets React stop. Compares the value: presence never settles.
 */
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

/**
 * The option an enum lands on: the one selected when visibility still allows it,
 * then the parameter's default, then whatever is left to pick.
 */
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

export function sameSelection(a: Selection | undefined, b: Selection): boolean {
    if (!a) return false;
    const keys = Object.keys(b);
    return (
        keys.length === Object.keys(a).length &&
        keys.every((key) => a[key] === b[key])
    );
}

/**
 * What the panel actually shows, with each parameter settled against the others.
 * Repeated because resolving one can change what conditions on it allow.
 *
 * The pass cap is what bounds it, not convergence: two parameters whose
 * conditions name each other could alternate forever, and no configuration
 * Onshape has handed us does, but nothing here rules it out. Bailing out that
 * way returns a selection that is not a fixed point, which is why the caller
 * writing this back has to guard against re-running rather than assume one
 * write settles it.
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
