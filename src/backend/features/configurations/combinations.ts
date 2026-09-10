/**
 * Enumerates an insertable's configuration combinations. Only enum and boolean
 * parameters vary; quantity and string ones ride their Onshape defaults.
 */
import {
    type PartialSelection,
    BooleanParameter,
    ConfigurationParameter,
    EnumParameter,
    ParameterType
} from "./models";
import { evaluateCondition, getVisibleOptions } from "./utils";

/**
 * The most combinations we enumerate for one insertable; beyond it nothing is
 * indexed, which is what bounds load time and Onshape usage.
 */
export const MAX_PART_NUMBER_CONFIGURATIONS = 512;

/**
 * At or above this, indexing waits for an admin, who can trim the count back
 * with "exclude from properties"; see the `MANUAL_INDEXING_REQUIRED` build issue.
 */
export const AUTO_INDEX_THRESHOLD = 128;

/** Where a configuration count sits relative to the two indexing limits. */
export enum IndexingBand {
    /** Under {@link AUTO_INDEX_THRESHOLD}: a non-custom insertable indexes on load. */
    AUTOMATIC = "automatic",
    /** Up to {@link MAX_PART_NUMBER_CONFIGURATIONS}: an admin must enable it. */
    MANUAL = "manual",
    /** Over {@link MAX_PART_NUMBER_CONFIGURATIONS}: cannot be indexed at all. */
    EXCEEDED = "exceeded"
}

/**
 * Shared with the admin card so the two cannot disagree. The count is the only
 * gate: past the cap nothing enumerates, past the threshold an admin decides.
 */
export function isIndexingEnabled(
    band: IndexingBand,
    indexConfigurations: boolean
): boolean {
    switch (band) {
        case IndexingBand.EXCEEDED:
            return false;
        case IndexingBand.MANUAL:
            return indexConfigurations;
        case IndexingBand.AUTOMATIC:
            return true;
    }
}

export interface ConfigurationCount {
    /**
     * The number of combinations, `0` when there is nothing to vary, or `null`
     * past the cap — enumeration stops there, so the true total is unknown.
     */
    count: number | null;
    band: IndexingBand;
    /** The combinations counted, so the load path need not enumerate again. */
    configurations: PartialSelection[];
}

/** Shared, so the load path and the admin UI agree on which limit applies. */
export function countConfigurations(
    parameters: ConfigurationParameter[]
): ConfigurationCount {
    const { configurations, capped } = enumerateConfigurations(parameters);
    if (capped) {
        return { count: null, band: IndexingBand.EXCEEDED, configurations: [] };
    }
    // The lone default that nothing-to-vary enumerates to is not a configuration
    // of its own: a non-configurable insertable has none.
    const count = configurations.some(
        (selection) => Object.keys(selection).length > 0
    )
        ? configurations.length
        : 0;
    return {
        count,
        band:
            count >= AUTO_INDEX_THRESHOLD
                ? IndexingBand.MANUAL
                : IndexingBand.AUTOMATIC,
        configurations
    };
}

/**
 * Whether indexing varies this parameter, and so multiplies the count. Shared
 * with the admin card so it cannot drift from {@link enumerateConfigurations}.
 */
export function isIndexedParameter(
    parameter: ConfigurationParameter
): parameter is EnumParameter | BooleanParameter {
    if (
        parameter.type !== ParameterType.ENUM &&
        parameter.type !== ParameterType.BOOLEAN
    ) {
        return false;
    }
    return !parameter.isCosmetic;
}

/**
 * The values enumeration varies this parameter over, given what the combination
 * has fixed so far. None when its condition hides it here, or when visibility
 * leaves it no option: either way it is left unset for Onshape to default.
 */
function parameterValues(
    parameter: EnumParameter | BooleanParameter,
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): string[] {
    if (!evaluateCondition(parameter.condition, selection, parameters)) {
        return [];
    }
    if (parameter.type === ParameterType.BOOLEAN) {
        return ["true", "false"];
    }
    return getVisibleOptions(parameter, selection, parameters).map(
        (option) => option.id
    );
}

/** The most combinations counted for display, far past the index cap on work. */
export const MAX_COUNTED_CONFIGURATIONS = 100_000;

/** The true count, which runs past the index cap so the admin card can show it. */
export function countCombinations(
    parameters: ConfigurationParameter[],
    cap: number = MAX_COUNTED_CONFIGURATIONS
): number | null {
    // Depth-first: only the count is wanted, so one path is held rather than all.
    const indexed = parameters.filter(isIndexedParameter);
    let count = 0;
    let capped = false;

    const walk = (depth: number, selection: PartialSelection) => {
        if (depth === indexed.length) {
            // The lone empty default is not a configuration of its own.
            if (Object.keys(selection).length > 0) {
                count++;
                capped = count > cap;
            }
            return;
        }
        const parameter = indexed[depth];
        const values = parameterValues(parameter, selection, parameters);
        if (values.length === 0) {
            walk(depth + 1, selection);
            return;
        }
        for (const value of values) {
            walk(depth + 1, { ...selection, [parameter.id]: value });
            if (capped) {
                return;
            }
        }
    };

    walk(0, {});
    return capped ? null : count;
}

export interface EnumerateResult {
    /** What each combination varies — enums and booleans — which is why these
     * are partial; the only caller runs `toSelection` over them. */
    configurations: PartialSelection[];
    /** True when enumeration was stopped for exceeding the cap. */
    capped: boolean;
}

/**
 * The cartesian product of enum and boolean values, minus what visibility hides.
 * Declaration order is load-bearing: search dedupes first-wins.
 */
export function enumerateConfigurations(
    parameters: ConfigurationParameter[],
    cap: number = MAX_PART_NUMBER_CONFIGURATIONS
): EnumerateResult {
    let configurations: PartialSelection[] = [{}];

    for (const parameter of parameters) {
        if (!isIndexedParameter(parameter)) {
            continue;
        }

        const next: PartialSelection[] = [];
        for (const selection of configurations) {
            const values = parameterValues(parameter, selection, parameters);
            // Nothing to vary here, so the parameter is left unset;
            // `toSelection` fills it from the default Onshape would apply.
            if (values.length === 0) {
                next.push(selection);
                continue;
            }

            for (const value of values) {
                next.push({ ...selection, [parameter.id]: value });
            }
        }

        configurations = next;
        if (configurations.length > cap) {
            return { configurations: [], capped: true };
        }
    }

    return { configurations, capped: false };
}
