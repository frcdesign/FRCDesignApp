/**
 * Part numbers: extracting them from Onshape's responses, and indexing an
 * insertable's configurations into the map search uses.
 *
 * Part numbers become search terms and the keys of a `PartNumberMap`, so a value
 * is normalized (trimmed) and a blank one is treated as unset.
 *
 * Like `parseFastenInfo`, the indexing entry points take a client and call
 * Onshape themselves, so the extraction rules and the walk that uses them live
 * together.
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
    BuildIssueType
} from "../../shared/build-issues";
import { enumerateConfigurations } from "../../shared/configuration-combinations";
import {
    getAssemblyDefinition,
    getParts
} from "../onshape-api/endpoints/parts";
import type {
    OnshapeAssemblyDefinition,
    OnshapePart
} from "../onshape-api/onshape-types";
import {
    type LoadContext,
    getOnshapeApiFromContext
} from "../load/load-common";
import { ONSHAPE_STEP_RETRIES } from "../load/load-steps";

/** Configurations fetched per workflow step. */
const BATCH_SIZE = 20;

/** An insertable's indexed part numbers, and the issues indexing them raised. */
export interface PartNumberResult {
    /**
     * The part number of the insertable's default configuration, whether or not
     * it is configurable. Also present in `partNumbers` for configurable ones.
     */
    defaultPartNumber: string | null;
    /** Deduped map of part number -> the configuration that produces it. */
    partNumbers: PartNumberMap;
    /** Issues raised while indexing; see {@link PART_NUMBER_ISSUE_TYPES}. */
    buildIssues: BuildIssue[];
}

/** The result for an insertable that isn't indexed. */
export const NO_PART_NUMBERS: PartNumberResult = {
    defaultPartNumber: null,
    partNumbers: {},
    buildIssues: []
};

/**
 * The issue types indexing owns. A caller merging a fresh result into stored
 * issues clears these first, so a resolved issue doesn't stick around.
 */
export const PART_NUMBER_ISSUE_TYPES = [
    BuildIssueType.TOO_MANY_CONFIGURATIONS,
    BuildIssueType.MULTIPLE_PARTS,
    BuildIssueType.UNSTABLE_COMPOSITE
];

/**
 * Normalizes a raw part-number property: trims surrounding whitespace and maps
 * a missing or blank value to `null`.
 */
export function normalizePartNumber(
    partNumber: string | undefined
): string | null {
    const trimmed = partNumber?.trim();
    return trimmed ? trimmed : null;
}

/** What a part studio's parts resolve to, before build issues are decided. */
export interface PartsEvaluation {
    /** True when more than one part could be the one to index. */
    hasMultipleParts: boolean;
    /** True when the studio is an open composite (see {@link computeOpenComposite}). */
    isOpenComposite: boolean;
    /** The part whose number to index, or `undefined` when there are none. */
    partToUse: OnshapePart | undefined;
}

/**
 * The one place that reads meaning out of a `/parts` response: whether the
 * studio is an open composite, and which part carries the number to index. An
 * indexed part studio is meant to be a single part; an open composite is the
 * exception, where only the composite matters and the loose constituents are
 * ignored. More than one candidate (part, or composite) is the arbitrary-choice
 * case that `MULTIPLE_PARTS` flags.
 */
export function evaluateParts(parts: OnshapePart[]): PartsEvaluation {
    const composites = parts.filter((part) => part.bodyType === "composite");
    if (parts.length > 1 && composites.length > 0) {
        return {
            hasMultipleParts: composites.length > 1,
            isOpenComposite: true,
            partToUse: composites[0]
        };
    }
    return {
        hasMultipleParts: parts.length > 1,
        isOpenComposite: false,
        partToUse: parts[0]
    };
}

/**
 * Whether a part studio is an open composite: it resolves to more than one part
 * and one of them is the composite. Stable across configurations, so it's
 * computed once from the default configuration.
 */
export function computeOpenComposite(parts: OnshapePart[]): boolean {
    return evaluateParts(parts).isOpenComposite;
}

/** What a part studio resolved to for one configuration. */
export interface PartStudioParts {
    /** The part number of its part, or `null` if none is set. */
    partNumber: string | null;
    /** True when the studio has more than one part; see `MULTIPLE_PARTS`. */
    hasMultipleParts: boolean;
    /** True when an open composite lost its composite here; see `UNSTABLE_COMPOSITE`. */
    isUnstableComposite: boolean;
}

/**
 * Reads a part studio's part number for one configuration. `isOpenComposite` is
 * the studio's expected state (from its default configuration): a config that
 * doesn't resolve to a composite when one is expected is an `UNSTABLE_COMPOSITE`,
 * and we index nothing for it rather than a stray constituent part.
 */
export function parsePartStudioParts(
    parts: OnshapePart[],
    isOpenComposite: boolean
): PartStudioParts {
    const evaluation = evaluateParts(parts);
    if (isOpenComposite && !evaluation.isOpenComposite) {
        return {
            partNumber: null,
            hasMultipleParts: false,
            isUnstableComposite: true
        };
    }
    return {
        partNumber: normalizePartNumber(evaluation.partToUse?.partNumber),
        hasMultipleParts: evaluation.hasMultipleParts,
        isUnstableComposite: false
    };
}

/**
 * Returns the root assembly's part number, or `null` if none is set.
 */
export function parseAssemblyPartNumber(
    definition: OnshapeAssemblyDefinition
): string | null {
    return normalizePartNumber(definition.rootAssembly.partNumber);
}

/**
 * Indexes an insertable's part numbers in one pass. For request handlers, which
 * have no workflow step to hang the fetches off.
 */
export async function parsePartNumbers(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[],
    isOpenComposite: boolean
): Promise<PartNumberResult> {
    const probe = await probePartNumber(
        client,
        elementPath,
        elementType,
        {},
        isOpenComposite
    );
    const { batches, capped } = planPartNumberBatches(parameters);

    const fetched: PartNumberBatch[] = [];
    for (const batch of batches) {
        fetched.push(
            await fetchPartNumberBatch(
                client,
                elementPath,
                elementType,
                batch,
                isOpenComposite
            )
        );
    }
    return toPartNumberResult(probe, fetched, capped);
}

/**
 * Indexes an insertable's part numbers as part of its load, one durable step per
 * batch of configurations, so a rate-limited retry re-fetches only that batch.
 * Batches run sequentially — insertables already load in parallel, which is
 * where the concurrency comes from.
 *
 * A batch that exhausts its retries throws, failing the insertable rather than
 * saving a half-built map; the stored row keeps its previous part numbers.
 */
export async function loadPartNumbers(
    ctx: LoadContext,
    insertableId: string,
    elementPath: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[],
    isOpenComposite: boolean
): Promise<PartNumberResult> {
    const probe = await ctx.step.do(
        `part-numbers-${insertableId}-default`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            probePartNumber(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                elementType,
                {},
                isOpenComposite
            )
    );
    const { batches, capped } = planPartNumberBatches(parameters);

    const fetched: PartNumberBatch[] = [];
    for (const [index, batch] of batches.entries()) {
        fetched.push(
            await ctx.step.do(
                `part-numbers-${insertableId}-batch-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () =>
                    fetchPartNumberBatch(
                        await getOnshapeApiFromContext(ctx),
                        elementPath,
                        elementType,
                        batch,
                        isOpenComposite
                    )
            )
        );
    }
    return toPartNumberResult(probe, fetched, capped);
}

/** A part number and the configuration that produces it. */
interface PartNumberEntry {
    partNumber: string;
    configuration: ParameterValues;
}

/** What one batch of configurations resolved to. */
interface PartNumberBatch {
    entries: PartNumberEntry[];
    /** True when any configuration in the batch resolved to >1 part. */
    hasMultipleParts: boolean;
    /** True when any configuration in the batch lost its composite. */
    isUnstableComposite: boolean;
}

/**
 * Splits an insertable's configuration combinations into the batches to fetch.
 *
 * An insertable with nothing to vary — no parameters, or only quantity and
 * string ones — enumerates to a single empty configuration, which is what the
 * default probe already asked for. Dropping it leaves no batches at all rather
 * than fetching the defaults twice.
 */
function planPartNumberBatches(parameters: ConfigurationParameter[]): {
    batches: ParameterValues[][];
    capped: boolean;
} {
    const { configurations, capped } = enumerateConfigurations(parameters);
    if (capped) {
        return { batches: [], capped: true };
    }
    const toFetch = configurations.filter(
        (configuration) => Object.keys(configuration).length > 0
    );

    const batches: ParameterValues[][] = [];
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        batches.push(toFetch.slice(i, i + BATCH_SIZE));
    }
    return { batches, capped: false };
}

/**
 * Reads what Onshape reports for an element in a given configuration. A part
 * studio's number comes from its part; an assembly's from the root assembly.
 */
async function probePartNumber(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    configuration: ParameterValues,
    isOpenComposite: boolean
): Promise<PartStudioParts> {
    if (elementType === ElementType.ASSEMBLY) {
        return {
            partNumber: parseAssemblyPartNumber(
                await getAssemblyDefinition(client, elementPath, configuration)
            ),
            hasMultipleParts: false,
            isUnstableComposite: false
        };
    }
    return parsePartStudioParts(
        await getParts(client, elementPath, configuration),
        isOpenComposite
    );
}

/** Probes each configuration in a batch, dropping blank part numbers. */
async function fetchPartNumberBatch(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    batch: ParameterValues[],
    isOpenComposite: boolean
): Promise<PartNumberBatch> {
    const entries: PartNumberEntry[] = [];
    let hasMultipleParts = false;
    let isUnstableComposite = false;
    for (const configuration of batch) {
        const probe = await probePartNumber(
            client,
            elementPath,
            elementType,
            configuration,
            isOpenComposite
        );
        hasMultipleParts ||= probe.hasMultipleParts;
        isUnstableComposite ||= probe.isUnstableComposite;
        if (probe.partNumber) {
            entries.push({ partNumber: probe.partNumber, configuration });
        }
    }
    return { entries, hasMultipleParts, isUnstableComposite };
}

/**
 * Folds the default probe and every batch into the stored result.
 *
 * The map is keyed by part number, first-wins, so configurations resolving to
 * the same part collapse onto the earliest one. `MULTIPLE_PARTS` and
 * `UNSTABLE_COMPOSITE` are raised when *any* configuration tripped them — the
 * flags ride on the batch rather than on an entry because entries with a blank
 * part number are dropped and would lose them.
 */
function toPartNumberResult(
    probe: PartStudioParts,
    batches: PartNumberBatch[],
    capped: boolean
): PartNumberResult {
    const partNumbers: PartNumberMap = {};
    let hasMultipleParts = probe.hasMultipleParts;
    let isUnstableComposite = probe.isUnstableComposite;
    for (const batch of batches) {
        hasMultipleParts ||= batch.hasMultipleParts;
        isUnstableComposite ||= batch.isUnstableComposite;
        for (const entry of batch.entries) {
            partNumbers[entry.partNumber] ??= entry.configuration;
        }
    }

    let buildIssues: BuildIssue[] = [];
    if (capped) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.TOO_MANY_CONFIGURATIONS
        });
    }
    if (hasMultipleParts) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.MULTIPLE_PARTS
        });
    }
    if (isUnstableComposite) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.UNSTABLE_COMPOSITE
        });
    }

    return { defaultPartNumber: probe.partNumber, partNumbers, buildIssues };
}
