/**
 * Enumerates an insertable's configuration combinations. Only enum and boolean
 * parameters vary; quantity and string ones ride their Onshape defaults.
 */
import {
    ParameterValues,
    BooleanParameter,
    ConfigurationParameter,
    EnumParameter,
    ParameterType
} from "./configuration-models";
import { evaluateCondition, getVisibleOptions } from "./configuration-utils";

/**
 * The most combinations we enumerate for one insertable; beyond it nothing is
 * indexed, which is what bounds load time and Onshape usage.
 */
export const MAX_PART_NUMBER_CONFIGURATIONS = 512;

/**
 * At or above this, indexing waits for an admin, who can trim the count back
 * with "exclude from properties"; see the `MANY_CONFIGURATIONS` build issue.
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
    configurations: ParameterValues[];
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

export interface EnumerateResult {
    /** The enumerated configurations, or empty when `capped`. */
    configurations: ParameterValues[];
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
    let configurations: ParameterValues[] = [{}];

    for (const parameter of parameters) {
        if (!isIndexedParameter(parameter)) {
            continue;
        }

        const next: ParameterValues[] = [];
        for (const configuration of configurations) {
            // A parameter hidden in this partial configuration is left unset;
            // Onshape applies its default.
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
