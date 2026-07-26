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
    /**
     * The lowest `X-Rate-Limit-Remaining` observed while fetching, or undefined
     * if nothing was fetched. The scheduler uses it to update its budget.
     */
    minRemaining: number | undefined;
}

/** Headroom kept below the reported remaining count when packing waves. */
export const PART_NUMBER_RATE_LIMIT_RESERVE = 20;

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
    let minRemaining: number | undefined;
    const track = () => {
        const remaining = client.lastRateLimitRemaining;
        if (remaining !== undefined) {
            minRemaining =
                minRemaining === undefined
                    ? remaining
                    : Math.min(minRemaining, remaining);
        }
    };

    // Non-configurable insertables have a single part number, stored on the
    // insertable itself (there is no configurations row to hold a map).
    if (parameters.length === 0) {
        const defaultPartNumber = await getPartNumber(
            client,
            path,
            elementType,
            {}
        );
        track();
        return {
            defaultPartNumber,
            partNumbers: {},
            capped: false,
            minRemaining
        };
    }

    const { configurations, capped } = enumerateConfigurations(parameters, cap);
    if (capped) {
        return {
            defaultPartNumber: null,
            partNumbers: {},
            capped: true,
            minRemaining
        };
    }

    const partNumbers: PartNumberMap = {};
    for (const configuration of configurations) {
        const partNumber = await getPartNumber(
            client,
            path,
            elementType,
            configuration
        );
        track();
        // First-wins keeps the earliest (default-preferring) configuration per
        // part number, deduping combinations that resolve to the same part.
        if (partNumber && !(partNumber in partNumbers)) {
            partNumbers[partNumber] = configuration;
        }
    }

    return {
        defaultPartNumber: null,
        partNumbers,
        capped: false,
        minRemaining
    };
}

/**
 * Given the costs of the still-pending jobs (in order) and the current budget,
 * returns how many leading jobs form the next parallel wave: as many as fit
 * within `budget - reserve`, but always at least one so a job whose cost alone
 * exceeds the budget still runs (in its own wave). The scheduler calls this
 * repeatedly with the remaining jobs and the live budget.
 */
export function nextWaveSize(
    pendingCosts: number[],
    budget: number,
    reserve: number = PART_NUMBER_RATE_LIMIT_RESERVE
): number {
    const usable = Math.max(budget - reserve, 0);
    let count = 0;
    let sum = 0;
    for (const cost of pendingCosts) {
        if (count > 0 && sum + cost > usable) {
            break;
        }
        sum += cost;
        count += 1;
    }
    return Math.max(count, 1);
}
