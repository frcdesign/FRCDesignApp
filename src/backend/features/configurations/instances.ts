/**
 * A list whose options another choice filters is really several lists, one per
 * way it is shown; reporting on it as one merges choices never offered together.
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
import { formatValue } from "./selection";
import {
    evaluateCondition,
    getOption,
    getVisibleOptions,
    resolveSelectedOption
} from "./utils";

// Past either cap a parameter is reported whole: too many instances is
// unreadable.
const MAX_COMBINATIONS = 256;
const MAX_INSTANCES = 16;

/** One controlling choice on the way to an instance. */
interface InstanceStep {
    parameterId: string;
    /** e.g. "Generic", or "Generic or WCP" when both lead to the same list. */
    label: string;
}

/** One parameter as it is shown under one set of controlling choices. */
interface ParameterInstance {
    parameter: ConfigurationParameter;
    /** Outermost first; empty when nothing conditions it. */
    path: InstanceStep[];
    /** In declaration order; empty for anything but an enum. */
    options: EnumOption[];
    /** Set when the declared default isn't offered; see `resolveSelectedOption`. */
    implicitDefaultId?: string;
}

/** One per way each parameter is shown; an unconditioned one gets a single instance with an empty path. */
export function toParameterInstances(
    parameters: ConfigurationParameter[]
): ParameterInstance[] {
    return parameters.flatMap((parameter) => {
        try {
            return instancesOf(parameter, parameters);
        } catch {
            // A stale condition shouldn't take down the library's whole report.
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

    // Keyed by the options, so vendors that filter alike share an instance.
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

    // Nothing shows it, yet values were recorded against it, so report it whole
    // rather than drop it.
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
 * Transitive: a list filtered by a vendor whose options a series filters is
 * shown once per pair.
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

    // A quantity takes any number, so it can't be enumerated.
    return parameters.filter(
        (entry) =>
            found.has(entry.id) &&
            (entry.type === ParameterType.ENUM ||
                entry.type === ParameterType.BOOLEAN)
    );
}

/** In declaration order, so each is enumerated against what is fixed. Undefined past the cap. */
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
            // Hidden under what is fixed, so it stays unset.
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

/** Leaves out a controller whose every value leads here. */
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
            label: toStepLabel(controller, [...chosen])
        });
    }

    return steps;
}

/**
 * An option names itself ("Generic", not "Vendor: Generic"); a checkbox names
 * its parameter and state.
 */
function toStepLabel(
    parameter: ConfigurationParameter,
    values: string[]
): string {
    if (parameter.type === ParameterType.ENUM) {
        return values
            .map((value) => getOption(parameter.options, value)?.name ?? value)
            .join(" or ");
    }
    const states = values
        .map((value) => formatValue(parameter, value))
        .join(" or ");
    return `${parameter.name}: ${states}`;
}

function toImplicitDefault(
    parameter: ConfigurationParameter,
    options: EnumOption[]
): string | undefined {
    if (parameter.type !== ParameterType.ENUM) {
        return undefined;
    }
    const settled = resolveSelectedOption(
        options,
        undefined,
        parameter.default
    );
    return settled?.id === parameter.default ? undefined : settled?.id;
}
