/**
 * The ways one parameter can be shown. A list whose options another choice
 * filters is not one list but several, and anything reporting on it as one
 * merges choices that were never offered together.
 */
import {
    type ConfigurationParameter,
    type EnumOption,
    type PartialSelection,
    ParameterType,
    type VisibilityCondition,
    VisibilityType
} from "./contract";
import { parameterValues } from "./combinations";
import { evaluateCondition, getOption, getVisibleOptions } from "./utils";

/**
 * The combinations of controlling choices one parameter is walked over, and the
 * instances that may come out of it. Past either the parameter is reported
 * whole: an instanced report nobody can read is worse than an aggregated one.
 */
const MAX_COMBINATIONS = 256;
const MAX_INSTANCES = 16;

/** One controlling choice on the way to an instance. */
export interface InstanceStep {
    parameterId: string;
    /** The choices leading here, e.g. "Generic"; several when they lead to the
     * same list, joined as "Generic or WCP". */
    label: string;
}

/** One parameter as it is shown under one set of controlling choices. */
export interface ParameterInstance {
    parameter: ConfigurationParameter;
    /** The choices it is shown under, outermost first; empty when nothing
     * conditions it. */
    path: InstanceStep[];
    /** What it offers here, in declaration order; empty for anything that is
     * not an enum, which declares no options to filter. */
    options: EnumOption[];
    /**
     * The option the app lands on here because the declared default is not
     * offered; see `resolveSelectedOption`, which falls through to the first.
     */
    implicitDefaultId?: string;
}

/**
 * Every parameter, once per way it is shown. Parameter order is kept, and a
 * parameter nothing conditions yields exactly one instance with an empty path —
 * which is what an un-instanced report already was.
 */
export function toParameterInstances(
    parameters: ConfigurationParameter[]
): ParameterInstance[] {
    return parameters.flatMap((parameter) => {
        try {
            return instancesOf(parameter, parameters);
        } catch {
            // `evaluateCondition` throws on a condition naming a parameter that
            // is not an enum any more. One part's conditions going stale must
            // not take down a whole library's report, so it reports whole.
            return [wholeInstance(parameter)];
        }
    });
}

function instancesOf(
    parameter: ConfigurationParameter,
    parameters: ConfigurationParameter[]
): ParameterInstance[] {
    const controllers = controllingParameters(parameter, parameters);
    if (controllers.length === 0) {
        return [wholeInstance(parameter)];
    }

    const combinations = enumerateControls(controllers, parameters);
    if (combinations === undefined) {
        return [wholeInstance(parameter)];
    }

    // Keyed by what the parameter offers, so two vendors that filter the list
    // the same way are one instance rather than two identical ones.
    const groups = new Map<
        string,
        { combinations: PartialSelection[]; options: EnumOption[] }
    >();

    for (const combination of combinations) {
        if (!evaluateCondition(parameter.condition, combination, parameters)) {
            continue;
        }
        const options =
            parameter.type === ParameterType.ENUM
                ? getVisibleOptions(parameter, combination, parameters)
                : [];
        const key = options.map((option) => option.id).join(";");
        const group = groups.get(key);
        if (group) {
            group.combinations.push(combination);
        } else {
            groups.set(key, { combinations: [combination], options });
        }
    }

    // No combination shows it, which means the conditions cannot be satisfied
    // the way they were read. The values recorded against it say otherwise, so
    // it is reported whole rather than dropped.
    if (groups.size === 0 || groups.size > MAX_INSTANCES) {
        return [wholeInstance(parameter)];
    }

    return [...groups.values()].map((group) => ({
        parameter,
        path: toPath(group.combinations, combinations, controllers),
        options: group.options,
        implicitDefaultId: toImplicitDefault(parameter, group.options)
    }));
}

/** The parameter as one instance: everything it declares, under no path. */
function wholeInstance(parameter: ConfigurationParameter): ParameterInstance {
    return {
        parameter,
        path: [],
        options: parameter.type === ParameterType.ENUM ? parameter.options : []
    };
}

/** The ids a condition reads, added to `into`. */
function readIds(
    condition: VisibilityCondition | undefined,
    into: Set<string>
): void {
    if (!condition) {
        return;
    }
    if (condition.type === VisibilityType.LOGICAL) {
        for (const child of condition.children) readIds(child, into);
    } else if (
        condition.type === VisibilityType.EQUAL ||
        condition.type === VisibilityType.RANGE
    ) {
        into.add(condition.id);
    }
}

/** Every condition deciding how one parameter is shown: its own and its options'. */
function conditionsOf(
    parameter: ConfigurationParameter
): (VisibilityCondition | undefined)[] {
    if (parameter.type !== ParameterType.ENUM) {
        return [parameter.condition];
    }
    return [
        parameter.condition,
        ...parameter.optionConditions.map((option) => option.condition)
    ];
}

/**
 * The parameters whose choices decide how `parameter` is shown, in declaration
 * order. Transitive: a list filtered by a vendor whose own options a series
 * filters is shown once per pair, and enumerating the vendor needs the series
 * fixed first.
 */
function controllingParameters(
    parameter: ConfigurationParameter,
    parameters: ConfigurationParameter[]
): ConfigurationParameter[] {
    const byId = new Map(parameters.map((entry) => [entry.id, entry]));
    const found = new Set<string>();
    const pending = [parameter];

    while (pending.length > 0) {
        const next = pending.pop()!;
        const ids = new Set<string>();
        for (const condition of conditionsOf(next)) readIds(condition, ids);
        for (const id of ids) {
            if (id === parameter.id || found.has(id)) continue;
            found.add(id);
            const controller = byId.get(id);
            if (controller) pending.push(controller);
        }
    }

    // Only an enum or a boolean can be walked over: a quantity takes any number
    // the user types, which is no set of instances.
    return parameters.filter(
        (entry) =>
            found.has(entry.id) &&
            (entry.type === ParameterType.ENUM ||
                entry.type === ParameterType.BOOLEAN)
    );
}

/**
 * Every combination of controlling choices, in declaration order so each is
 * enumerated against what is already fixed. Undefined past the cap, where the
 * paths would outnumber the options they lead to.
 */
function enumerateControls(
    controllers: ConfigurationParameter[],
    parameters: ConfigurationParameter[]
): PartialSelection[] | undefined {
    let combinations: PartialSelection[] = [{}];

    for (const controller of controllers) {
        if (
            controller.type !== ParameterType.ENUM &&
            controller.type !== ParameterType.BOOLEAN
        ) {
            continue;
        }
        const next: PartialSelection[] = [];
        for (const combination of combinations) {
            const values = parameterValues(controller, combination, parameters);
            // Nothing to vary here — it is hidden under what is already fixed —
            // so it stays unset, and the conditions reading it do not hold.
            if (values.length === 0) {
                next.push(combination);
                continue;
            }
            for (const value of values) {
                next.push({ ...combination, [controller.id]: value });
            }
        }
        if (next.length > MAX_COMBINATIONS) {
            return undefined;
        }
        combinations = next;
    }

    return combinations;
}

/** The values one controller took across a set of combinations. */
function valuesOf(
    combinations: PartialSelection[],
    parameterId: string
): Set<string> {
    const values = new Set<string>();
    for (const combination of combinations) {
        const value = combination[parameterId];
        if (value !== undefined) values.add(value);
    }
    return values;
}

/**
 * What to call the way here. A controller every combination reaches this
 * instance through says nothing about it — it is why it is not in the path.
 */
function toPath(
    group: PartialSelection[],
    combinations: PartialSelection[],
    controllers: ConfigurationParameter[]
): InstanceStep[] {
    const steps: InstanceStep[] = [];

    for (const controller of controllers) {
        const chosen = valuesOf(group, controller.id);
        const every = valuesOf(combinations, controller.id);
        // `chosen` is a subset of `every`, so equal sizes are equal sets.
        if (chosen.size === 0 || chosen.size === every.size) continue;
        steps.push({
            parameterId: controller.id,
            label: [...chosen]
                .map((value) => valueLabel(controller, value))
                .join(" or ")
        });
    }

    return steps;
}

/** One controlling choice as a person would name it. */
function valueLabel(parameter: ConfigurationParameter, value: string): string {
    if (parameter.type === ParameterType.ENUM) {
        return getOption(parameter.options, value)?.name ?? value;
    }
    // A checkbox is named for what it turns on, so the path reads as the state
    // rather than as "true".
    return value === "true" ? parameter.name : `No ${parameter.name}`;
}

function toImplicitDefault(
    parameter: ConfigurationParameter,
    options: EnumOption[]
): string | undefined {
    if (parameter.type !== ParameterType.ENUM || options.length === 0) {
        return undefined;
    }
    if (options.some((option) => option.id === parameter.default)) {
        return undefined;
    }
    return options[0].id;
}
