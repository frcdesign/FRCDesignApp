/**
 * Enumerates the configuration combinations of an insertable for part-number
 * indexing. Only enum and boolean parameters are varied; quantity and string
 * parameters are held at their Onshape defaults (omitted from the record).
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
 * The most configuration combinations we enumerate for a single insertable.
 * Beyond this the insertable is flagged and its part numbers are not indexed,
 * protecting load time and Onshape API usage.
 */
export const MAX_PART_NUMBER_CONFIGURATIONS = 512;

/**
 * Below this many combinations, a vendor insertable is indexed automatically on
 * load. At or above it, indexing waits for an admin to turn it on (after
 * trimming the count via "exclude from properties"); see the `MANY_CONFIGURATIONS`
 * build issue.
 */
export const AUTO_INDEX_THRESHOLD = 128;

/** Where a configuration count sits relative to the two indexing limits. */
export enum IndexingBand {
    /** Under {@link AUTO_INDEX_THRESHOLD}: a vendor insertable indexes on load. */
    AUTOMATIC = "automatic",
    /** Up to {@link MAX_PART_NUMBER_CONFIGURATIONS}: an admin must enable it. */
    MANUAL = "manual",
    /** Over {@link MAX_PART_NUMBER_CONFIGURATIONS}: cannot be indexed at all. */
    EXCEEDED = "exceeded"
}

/**
 * Whether an insertable's part numbers end up indexed: automatically for a
 * vendor insertable under the auto threshold, by hand wherever an admin enables
 * it, and never past the cap — enumeration stops there, so there is nothing to
 * index however the flag is set.
 *
 * Shared with the admin card, so what it reports can't drift from what the load
 * path actually does.
 */
export function isIndexingEnabled(
    hasVendor: boolean,
    band: IndexingBand,
    forceIndex: boolean
): boolean {
    switch (band) {
        case IndexingBand.EXCEEDED:
            return false;
        case IndexingBand.MANUAL:
            return forceIndex;
        case IndexingBand.AUTOMATIC:
            return hasVendor || forceIndex;
    }
}

export interface ConfigurationCount {
    /**
     * The number of combinations, `0` when there is nothing to vary, or `null`
     * past the cap — enumeration stops there, so the true total is unknown.
     */
    count: number | null;
    band: IndexingBand;
}

/**
 * Counts an insertable's configuration combinations and classifies what that
 * count means for part-number indexing. Shared so the load path and the admin
 * UI can't disagree about which limit an insertable falls under.
 */
export function countConfigurations(
    parameters: ConfigurationParameter[]
): ConfigurationCount {
    const { configurations, capped } = enumerateConfigurations(parameters);
    if (capped) {
        return { count: null, band: IndexingBand.EXCEEDED };
    }
    // An insertable with nothing to vary enumerates to the single default
    // configuration, which isn't a configuration of its own: a non-configurable
    // insertable has none.
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
                : IndexingBand.AUTOMATIC
    };
}

/**
 * Whether a parameter is varied when indexing part numbers, and so multiplies an
 * insertable's configuration count.
 *
 * Only enum and boolean parameters are varied — quantity and text ones ride
 * their Onshape defaults — and "exclude from properties" opts a parameter out,
 * which is how an insertable is trimmed back under the auto-index threshold.
 *
 * Shared with the admin card, so what it reports can't drift from what
 * {@link enumerateConfigurations} actually varies.
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
 * Returns the cartesian product of an insertable's enum and boolean parameter
 * values, pruning combinations hidden by visibility conditions.
 *
 * Parameters are folded in list order, and each parameter's values are appended
 * in the order Onshape declares them (first option first). That order is
 * load-bearing: part-number search dedupes configurations first-wins, so a part
 * number shared across an enum's options resolves to the first-listed — the
 * latest revision, by Onshape convention.
 *
 * Each parameter's (and each enum option's) visibility is evaluated against the
 * partial configuration built so far, matching how Onshape structures
 * configurations top-to-bottom.
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
