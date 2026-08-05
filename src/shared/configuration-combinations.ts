/**
 * Enumerates the configuration combinations of an insertable for part-number
 * indexing. Only enum and boolean parameters are varied; quantity and string
 * parameters are held at their Onshape defaults (omitted from the record).
 */
import {
    ParameterValues,
    ConfigurationParameter,
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
 * load. At or above it, indexing waits for an admin to force it on (after
 * trimming the count via "exclude from properties"); see the `MANY_CONFIGURATIONS`
 * build issue.
 */
export const AUTO_INDEX_THRESHOLD = 100;

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
        if (
            parameter.type !== ParameterType.ENUM &&
            parameter.type !== ParameterType.BOOLEAN
        ) {
            // Quantity and string parameters ride on their Onshape defaults.
            continue;
        }
        if (parameter.isCosmetic) {
            // "Exclude from properties": doesn't change the part's identity, so
            // it rides its default rather than multiplying the configuration count.
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
