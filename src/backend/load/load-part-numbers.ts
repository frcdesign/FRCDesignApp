/**
 * Computes the part-number data indexed for search when an insertable has
 * part-number search enabled: the default configuration's part number and, for
 * configurable insertables, a deduped map of part number -> configuration.
 */
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import { ElementType } from "../../shared/types";
import { ParameterObj, PartNumberMap } from "../../shared/configuration-models";
import {
    enumerateConfigurations,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../../shared/configuration-combinations";
import { getPartNumber } from "../onshape-api/endpoints/parts";

export interface ComputedPartNumbers {
    /**
     * The default configuration's part number, populated only for
     * non-configurable insertables (configurable ones carry it inside
     * `partNumbers`). `null` otherwise.
     */
    defaultPartNumber: string | null;
    /** Deduped map of part number -> the configuration that produces it. */
    partNumbers: PartNumberMap;
    /** True when enumeration was capped; `partNumbers` is left empty. */
    capped: boolean;
}

/**
 * Fetches the part number for each configuration combination and folds them
 * into a `PartNumberMap` keyed by part number (first-wins, so duplicates
 * collapse to one canonical, default-preferring configuration).
 */
export async function computePartNumbers(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType,
    parameters: ParameterObj[],
    cap: number = MAX_PART_NUMBER_CONFIGURATIONS
): Promise<ComputedPartNumbers> {
    // Non-configurable insertables have a single part number, stored on the
    // insertable itself (there is no configurations row to hold a map).
    if (parameters.length === 0) {
        const defaultPartNumber = await getPartNumber(
            client,
            path,
            elementType,
            {}
        );
        return { defaultPartNumber, partNumbers: {}, capped: false };
    }

    const { configurations, capped } = enumerateConfigurations(parameters, cap);
    if (capped) {
        return { defaultPartNumber: null, partNumbers: {}, capped: true };
    }

    const partNumbers: PartNumberMap = {};
    for (const configuration of configurations) {
        const partNumber = await getPartNumber(
            client,
            path,
            elementType,
            configuration
        );
        // First-wins keeps the earliest (default-preferring) configuration per
        // part number, deduping combinations that resolve to the same part.
        if (partNumber && !(partNumber in partNumbers)) {
            partNumbers[partNumber] = configuration;
        }
    }

    return { defaultPartNumber: null, partNumbers, capped: false };
}
