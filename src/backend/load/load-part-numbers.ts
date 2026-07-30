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
    ParameterValues,
    ConfigurationParameter,
    PartNumberMap
} from "../../shared/configuration-models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    clearBuildIssue
} from "../../shared/build-checker";
import { enumerateConfigurations } from "../../shared/configuration-combinations";
import {
    getAssemblyDefinition,
    getParts
} from "../onshape-api/endpoints/parts";
import {
    parseAssemblyPartNumber,
    parsePartStudioPartNumber
} from "../parse/parse-part-number";
import {
    type LoadContext,
    type ParseData,
    ONSHAPE_STEP_RETRIES,
    getOnshapeApiFromContext
} from "./load-utils";

/** Configurations fetched per workflow step. */
export const PART_NUMBER_BATCH_SIZE = 20;

/** A part number and the configuration that produces it. */
export interface PartNumberEntry {
    partNumber: string;
    configuration: ParameterValues;
}

/** An insertable's indexed part numbers, and the issues indexing them raised. */
export interface PartNumberResult {
    /**
     * The part number of the insertable's default configuration, whether or not
     * it is configurable. Also present in `partNumbers` for configurable ones.
     */
    defaultPartNumber: string | null;
    /** Deduped map of part number -> the configuration that produces it. */
    partNumbers: PartNumberMap;
    /** Issues raised while indexing, e.g. `TOO_MANY_CONFIGURATIONS`. */
    buildIssues: BuildIssue[];
}

/** The result for an insertable that isn't indexed. */
export const NO_PART_NUMBERS: PartNumberResult = {
    defaultPartNumber: null,
    partNumbers: {},
    buildIssues: []
};

/**
 * Replaces any part-number issues in `issues` with the ones `partNumbers`
 * raised, leaving unrelated issues alone. Used by both the load and the toggle
 * route so they record issues the same way.
 */
export function withPartNumberIssues(
    issues: BuildIssue[],
    partNumbers: PartNumberResult
): BuildIssue[] {
    let merged = clearBuildIssue(
        issues,
        BuildIssueType.TOO_MANY_CONFIGURATIONS
    );
    for (const issue of partNumbers.buildIssues) {
        merged = addBuildIssue(merged, issue);
    }
    return merged;
}

/**
 * Returns the part number Onshape reports for an element in a given
 * configuration, or `null` if none is set. A part studio insertable resolves to
 * a single part, so its part number comes from that part; an assembly uses the
 * root assembly's part number.
 */
export async function getPartNumber(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType,
    configuration: ParameterValues
): Promise<string | null> {
    if (elementType === ElementType.ASSEMBLY) {
        return parseAssemblyPartNumber(
            await getAssemblyDefinition(client, path, configuration)
        );
    }
    return parsePartStudioPartNumber(
        await getParts(client, path, configuration)
    );
}

/** Splits configurations into fixed-size batches, one per workflow step. */
export function batchConfigurations(
    configurations: ParameterValues[],
    batchSize: number = PART_NUMBER_BATCH_SIZE
): ParameterValues[][] {
    const batches: ParameterValues[][] = [];
    for (let i = 0; i < configurations.length; i += batchSize) {
        batches.push(configurations.slice(i, i + batchSize));
    }
    return batches;
}

/**
 * Folds fetched entries into a map keyed by part number. First-wins, so
 * configurations resolving to the same part collapse onto the earliest one.
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
    configurations: ParameterValues[]
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
 * The shape both indexing paths share: the default configuration's part number,
 * then — for a configurable insertable — every combination, batched.
 * `fetchDefault` and `fetchBatch` decide whether those run as workflow steps.
 */
async function collectPartNumbers(
    parameters: ConfigurationParameter[],
    fetchDefault: () => Promise<string | null>,
    fetchBatch: (
        batch: ParameterValues[],
        index: number
    ) => Promise<PartNumberEntry[]>
): Promise<PartNumberResult> {
    // An empty configuration tells Onshape to apply every default.
    const defaultPartNumber = await fetchDefault();
    if (parameters.length === 0) {
        return { defaultPartNumber, partNumbers: {}, buildIssues: [] };
    }

    const { configurations, capped } = enumerateConfigurations(parameters);
    if (capped) {
        return {
            defaultPartNumber,
            partNumbers: {},
            buildIssues: [{ type: BuildIssueType.TOO_MANY_CONFIGURATIONS }]
        };
    }

    const batches: PartNumberEntry[][] = [];
    for (const [index, batch] of batchConfigurations(
        configurations
    ).entries()) {
        batches.push(await fetchBatch(batch, index));
    }
    return {
        defaultPartNumber,
        partNumbers: mergePartNumbers(batches),
        buildIssues: []
    };
}

/**
 * Computes an insertable's part numbers in a single pass, without workflow
 * steps. Used by the toggle route, which runs in a request and has no `step`.
 */
export function computePartNumbers(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[]
): Promise<PartNumberResult> {
    return collectPartNumbers(
        parameters,
        () => getPartNumber(client, path, elementType, {}),
        (batch) => fetchPartNumbers(client, path, elementType, batch)
    );
}

/**
 * Loads an insertable's part numbers as part of its load, one durable step per
 * batch of configurations. Batches run sequentially — insertables already load
 * in parallel, which is where the concurrency comes from.
 *
 * A batch that exhausts its retries throws, failing the insertable rather than
 * saving a half-built map; the stored row keeps its previous part numbers.
 */
export function loadPartNumbers(
    ctx: LoadContext,
    { insertableId, insertablePath, elementType }: ParseData,
    parameters: ConfigurationParameter[]
): Promise<PartNumberResult> {
    return collectPartNumbers(
        parameters,
        () =>
            ctx.step.do(
                `part-number-${insertableId}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () =>
                    getPartNumber(
                        await getOnshapeApiFromContext(ctx),
                        insertablePath,
                        elementType,
                        {}
                    )
            ),
        (batch, index) =>
            ctx.step.do(
                `part-numbers-${insertableId}-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () =>
                    fetchPartNumbers(
                        await getOnshapeApiFromContext(ctx),
                        insertablePath,
                        elementType,
                        batch
                    )
            )
    );
}
