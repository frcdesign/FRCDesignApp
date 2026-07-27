/**
 * Part-number indexing for insertables with part-number search enabled.
 *
 * Owns both halves: computing one insertable's part numbers (the default
 * configuration's number, or a deduped map of part number -> configuration),
 * and scheduling a whole group's worth of that work against Onshape's rate
 * limit.
 */
import { and, eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import { ElementType } from "../../shared/types";
import { ParameterObj, PartNumberMap } from "../../shared/configuration-models";
import { configurations, insertables } from "../../shared/schema";
import {
    enumerateConfigurations,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../../shared/configuration-combinations";
import { getPartNumber } from "../onshape-api/endpoints/parts";
import { writePartNumbers } from "./load-insertable";
import {
    type LoadContext,
    ONSHAPE_STEP_RETRIES,
    getOnshapeApiFromLoadContext
} from "./load-utils";

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

/** A part-number indexing job for one insertable. */
interface PartNumberJob {
    insertableId: string;
    path: ElementPath;
    elementType: ElementType;
    parameters: ParameterObj[];
    /** Number of Onshape calls this job will make (0 when capped). */
    cost: number;
}

/**
 * Indexes part numbers for a group's `searchPartNumbers`-enabled insertables,
 * running per-insertable steps in cost-packed parallel waves that stay within
 * the live `X-Rate-Limit-Remaining` budget. Each insertable's cost is known up
 * front from `enumerateConfigurations`, so waves never intentionally exceed the
 * limit; a 429 from estimate drift is still waited out durably per step.
 */
export async function loadPartNumbers(
    ctx: LoadContext,
    groupId: string
): Promise<void> {
    const db = getDb(ctx.env.DB);
    const jobs = await ctx.step.do(`part-number-jobs-${groupId}`, () =>
        selectPartNumberJobs(db, groupId)
    );
    if (jobs.length === 0) {
        return;
    }

    let index = 0;
    // Undefined until the first response reports a remaining count; until then
    // (and if the header is ever absent) we fall back to one job at a time.
    let budget: number | undefined;
    while (index < jobs.length) {
        const waveSize =
            budget === undefined
                ? 1
                : nextWaveSize(
                      jobs.slice(index).map((job) => job.cost),
                      budget
                  );
        const wave = jobs.slice(index, index + waveSize);

        const reported = await Promise.all(
            wave.map((job) => runPartNumberJob(ctx, job))
        );
        const observed = reported.filter(
            (value): value is number => value !== undefined
        );
        if (observed.length > 0) {
            budget = Math.min(...observed);
        }
        index += waveSize;
    }
}

/**
 * Runs one insertable's part-number step (durable, honoring Retry-After) and a
 * write step, returning the lowest remaining count it observed. On retry
 * exhaustion it degrades to a flagged, empty result rather than failing the load.
 */
async function runPartNumberJob(
    ctx: LoadContext,
    job: PartNumberJob
): Promise<number | undefined> {
    let result: ComputedPartNumbers;
    let incomplete = false;
    try {
        result = await ctx.step.do(
            `part-numbers-${job.insertableId}`,
            { retries: ONSHAPE_STEP_RETRIES },
            async () =>
                computePartNumbers(
                    await getOnshapeApiFromLoadContext(ctx),
                    job.path,
                    job.elementType,
                    job.parameters
                )
        );
    } catch {
        result = {
            defaultPartNumber: null,
            partNumbers: {},
            capped: false,
            minRemaining: undefined
        };
        incomplete = true;
    }

    await ctx.step.do(`write-part-numbers-${job.insertableId}`, () =>
        writePartNumbers(getDb(ctx.env.DB), job.insertableId, {
            defaultPartNumber: result.defaultPartNumber,
            partNumbers: result.partNumbers,
            capped: result.capped,
            incomplete
        })
    );

    return result.minRemaining;
}

/** Loads the group's part-number jobs (enabled insertables + their parameters). */
async function selectPartNumberJobs(
    db: Db,
    groupId: string
): Promise<PartNumberJob[]> {
    const rows = await db
        .select({
            id: insertables.id,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            elementType: insertables.elementType,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(configurations, eq(configurations.id, insertables.id))
        .where(
            and(
                eq(insertables.groupId, groupId),
                eq(insertables.searchPartNumbers, true)
            )
        )
        .all();

    return rows.map((row) => {
        const parameters = row.parameters ?? [];
        const { configurations: combos, capped } =
            enumerateConfigurations(parameters);
        return {
            insertableId: row.id,
            path: {
                documentId: row.documentId,
                instanceId: row.versionId,
                instanceType: "v",
                elementId: row.elementId
            },
            elementType: row.elementType,
            parameters,
            cost: capped ? 0 : combos.length
        };
    });
}
