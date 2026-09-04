/**
 * Enumerates an insertable's configuration combinations. Only enum and boolean
 * parameters vary; quantity and string ones ride their Onshape defaults.
 */
import {
    Selection,
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
    configurations: Selection[];
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
        (configuration) => Object.keys(configuration).length > 0
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

    const walk = (depth: number, configuration: Selection) => {
        if (depth === indexed.length) {
            // The lone empty default is not a configuration of its own.
            if (Object.keys(configuration).length > 0) {
                count++;
                capped = count > cap;
            }
            return;
        }
        const parameter = indexed[depth];
        const values = evaluateCondition(
            parameter.condition,
            configuration,
            parameters
        )
            ? parameterValues(parameter, configuration, parameters)
            : [];
        // Hidden here, or with nothing to pick: left unset for Onshape to default.
        if (values.length === 0) {
            walk(depth + 1, configuration);
            return;
        }
        for (const value of values) {
            walk(depth + 1, { ...configuration, [parameter.id]: value });
            if (capped) {
                return;
            }
        }
    };

    walk(0, {});
    return capped ? null : count;
}

function parameterValues(
    parameter: EnumParameter | BooleanParameter,
    configuration: Selection,
    parameters: ConfigurationParameter[]
): string[] {
    if (parameter.type === ParameterType.BOOLEAN) {
        return ["true", "false"];
    }
    return getVisibleOptions(parameter, configuration, parameters).map(
        (option) => option.id
    );
}

export interface EnumerateResult {
    /**
     * What each combination varies: enum and boolean parameters only, so these
     * are the one place a map is not yet whole. `toSelection` makes them so,
     * which the only caller does before anything reads them.
     */
    configurations: Selection[];
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
    let configurations: Selection[] = [{}];

    for (const parameter of parameters) {
        if (!isIndexedParameter(parameter)) {
            continue;
        }

        const next: Selection[] = [];
        for (const configuration of configurations) {
            // A parameter hidden in this partial combination is left unset;
            // `toSelection` fills it from the default Onshape would apply.
            if (
                !evaluateCondition(
                    parameter.condition,
                    configuration,
                    parameters
                )
            ) {
                next.push(configuration);
                continue;
            }

            const values =
                parameter.type === ParameterType.BOOLEAN
                    ? ["true", "false"]
                    : getVisibleOptions(
                          parameter,
                          configuration,
                          parameters
                      ).map((option) => option.id);

            if (values.length === 0) {
                next.push(configuration);
                continue;
            }

            for (const value of values) {
                next.push({ ...configuration, [parameter.id]: value });
            }
        }

        configurations = next;
        if (configurations.length > cap) {
            return { configurations: [], capped: true };
        }
    }

    return { configurations, capped: false };
}
