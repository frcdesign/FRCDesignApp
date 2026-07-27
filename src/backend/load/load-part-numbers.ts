/**
 * Part-number indexing for insertables with part-number search enabled.
 *
 * Loading runs as part of the insertable's load, so part numbers are only
 * recomputed when the insertable itself is reloaded. Configurations are fetched
 * in small batches, one durable step each, so a rate-limited retry re-fetches
 * only that batch.
 */
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import { ElementType } from "../../shared/types";
import {
    Configuration,
    ParameterObj,
    PartNumberMap
} from "../../shared/configuration-models";
import {
    enumerateConfigurations,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../../shared/configuration-combinations";
import { getPartNumber } from "../onshape-api/endpoints/parts";
import {
    type InsertableToLoad,
    type LoadContext,
    ONSHAPE_STEP_RETRIES,
    getOnshapeApiFromLoadContext
} from "./load-utils";

/** Configurations fetched per workflow step. */
export const PART_NUMBER_BATCH_SIZE = 20;

/** A part number and the configuration that produces it. */
export interface PartNumberEntry {
    partNumber: string;
    configuration: Configuration;
}

export interface LoadedPartNumbers {
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

/** The empty result, used when part-number search is off or enumeration caps. */
function noPartNumbers(capped = false): LoadedPartNumbers {
    return { defaultPartNumber: null, partNumbers: {}, capped };
}

/** Splits configurations into fixed-size batches, one per workflow step. */
export function batchConfigurations(
    configurations: Configuration[],
    batchSize: number = PART_NUMBER_BATCH_SIZE
): Configuration[][] {
    const batches: Configuration[][] = [];
    for (let i = 0; i < configurations.length; i += batchSize) {
        batches.push(configurations.slice(i, i + batchSize));
    }
    return batches;
}

/**
 * Folds fetched entries into a map keyed by part number. First-wins, so
 * configurations resolving to the same part collapse onto the earliest
 * (default-preferring) one.
 */
export function mergePartNumbers(batches: PartNumberEntry[][]): PartNumberMap {
    const partNumbers: PartNumberMap = {};
    for (const batch of batches) {
        for (const entry of batch) {
            if (!(entry.partNumber in partNumbers)) {
                partNumbers[entry.partNumber] = entry.configuration;
            }
        }
    }
    return partNumbers;
}

/** Fetches the part number for each of `configurations`, dropping blanks. */
export async function fetchPartNumbers(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType,
    configurations: Configuration[]
): Promise<PartNumberEntry[]> {
    const entries: PartNumberEntry[] = [];
    for (const configuration of configurations) {
        const partNumber = await getPartNumber(
            client,
            path,
            elementType,
            configuration
        );
        if (partNumber) {
            entries.push({ partNumber, configuration });
        }
    }
    return entries;
}

/**
 * Computes an insertable's part numbers in a single pass, without workflow
 * steps. Used by the toggle route, which runs in a request and has no `step`.
 */
export async function computePartNumbers(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType,
    parameters: ParameterObj[],
    cap: number = MAX_PART_NUMBER_CONFIGURATIONS
): Promise<LoadedPartNumbers> {
    // Non-configurable insertables have a single part number, stored on the
    // insertable itself (there is no configurations row to hold a map).
    if (parameters.length === 0) {
        return {
            defaultPartNumber: await getPartNumber(
                client,
                path,
                elementType,
                {}
            ),
            partNumbers: {},
            capped: false
        };
    }

    const { configurations, capped } = enumerateConfigurations(parameters, cap);
    if (capped) {
        return noPartNumbers(true);
    }

    const entries = await fetchPartNumbers(
        client,
        path,
        elementType,
        configurations
    );
    return {
        defaultPartNumber: null,
        partNumbers: mergePartNumbers([entries]),
        capped: false
    };
}

/**
 * Loads an insertable's part numbers as part of its load, one durable step per
 * batch of configurations. Batches run sequentially — insertables already load
 * in parallel, which is where the concurrency comes from.
 *
 * A batch that exhausts its retries throws, failing the insertable rather than
 * saving a half-built map; the stored row keeps its previous part numbers.
 */
export async function loadPartNumbers(
    ctx: LoadContext,
    toLoad: InsertableToLoad,
    parameters: ParameterObj[]
): Promise<LoadedPartNumbers> {
    if (!toLoad.searchPartNumbers) {
        return noPartNumbers();
    }

    const { insertableId, path, elementType } = toLoad;
    const onshapeApi = () => getOnshapeApiFromLoadContext(ctx);

    if (parameters.length === 0) {
        const defaultPartNumber = await ctx.step.do(
            `part-number-${insertableId}`,
            { retries: ONSHAPE_STEP_RETRIES },
            async () => getPartNumber(await onshapeApi(), path, elementType, {})
        );
        return { defaultPartNumber, partNumbers: {}, capped: false };
    }

    const { configurations, capped } = enumerateConfigurations(parameters);
    if (capped) {
        return noPartNumbers(true);
    }

    const batches: PartNumberEntry[][] = [];
    for (const [index, batch] of batchConfigurations(
        configurations
    ).entries()) {
        batches.push(
            await ctx.step.do(
                `part-numbers-${insertableId}-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () =>
                    fetchPartNumbers(
                        await onshapeApi(),
                        path,
                        elementType,
                        batch
                    )
            )
        );
    }

    return {
        defaultPartNumber: null,
        partNumbers: mergePartNumbers(batches),
        capped: false
    };
}
