/**
 * Configuration records: probing an insertable's configurations for the metadata
 * we store (part number, name, description, material, vendor), and folding the
 * probes into the `ConfigurationRecord[]` a load persists.
 *
 * A part studio reads the typed `/parts` response; an assembly reads the element
 * metadata property bag. Either way, one probe produces one `ConfigurationRecord`.
 * Every probed configuration is kept — search dedupes to a per-part-number map
 * itself (`buildSearchDb`), and build checks may want the ones search drops.
 *
 * Like `parseFastenInfo`, the entry points take a client and call Onshape
 * themselves, so the extraction rules and the walk that uses them live together.
 */
import { OnshapeApi } from "../onshape-api/onshape-api";
import { ElementPath } from "../../shared/onshape-path";
import { ElementType, type Vendor } from "../../shared/types";
import {
    ParameterValues,
    ConfigurationParameter,
    ConfigurationRecord
} from "../../shared/configuration-models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../../shared/build-checker";
import {
    AUTO_INDEX_THRESHOLD,
    enumerateConfigurations
} from "../../shared/configuration-combinations";
import { getParts } from "../onshape-api/endpoints/parts";
import { getElementMetadata } from "../onshape-api/endpoints/metadata";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../onshape-api/onshape-types";
import {
    type LoadContext,
    getOnshapeApiFromContext
} from "../load/load-context";
import { ONSHAPE_STEP_RETRIES } from "../load/load-steps";

/** Configurations fetched per workflow step. */
const BATCH_SIZE = 20;

/** An insertable's configuration records, and the issues indexing them raised. */
export interface ConfigurationRecordsResult {
    records: ConfigurationRecord[];
    buildIssues: BuildIssue[];
}

/** The result for an insertable that isn't indexed. */
export const NO_RECORDS: ConfigurationRecordsResult = {
    records: [],
    buildIssues: []
};

/**
 * The issue types indexing owns. A caller merging a fresh result into stored
 * issues clears these first, so a resolved issue doesn't stick around.
 */
export const INDEXING_ISSUE_TYPES = [
    BuildIssueType.TOO_MANY_CONFIGURATIONS,
    BuildIssueType.MANY_CONFIGURATIONS,
    BuildIssueType.MULTIPLE_PARTS
];

/** Whether to index an insertable, and how to flag it if we don't. */
export interface IndexingDecision {
    /** Index when forced, or a vendor part below the auto threshold. */
    shouldIndex: boolean;
    /** Vendor part over the threshold and not forced: warrants a warning. */
    manyConfigurations: boolean;
}

/**
 * Decides whether an insertable's part numbers get indexed. A vendor part with
 * few enough combinations indexes on its own; anything else waits for the force
 * flag, and a vendor part held back only by its count is flagged so an admin can
 * trim it or force it.
 */
export function decideIndexing(
    vendors: Vendor[],
    parameters: ConfigurationParameter[],
    forceIndex: boolean
): IndexingDecision {
    const { configurations, capped } = enumerateConfigurations(parameters);
    const overThreshold =
        capped || configurations.length >= AUTO_INDEX_THRESHOLD;
    const autoEligible = vendors.length > 0 && !overThreshold;
    const shouldIndex = forceIndex || autoEligible;
    return {
        shouldIndex,
        manyConfigurations: vendors.length > 0 && overThreshold && !shouldIndex
    };
}

/** Trims a raw metadata value; a missing or blank one becomes `null`. */
function normalizeText(value: string | undefined | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Builds a record from a part studio's parts for one configuration.
 *
 * A studio meant for insertion is a single part, so we read the first part
 * carrying a part number (falling back to the first part). More than one part
 * means that choice was arbitrary — `hasMultipleParts` flags it.
 */
export function parsePartStudioRecord(
    parts: OnshapePart[],
    configuration: ParameterValues
): ConfigurationRecord {
    const part = parts.find((p) => normalizeText(p.partNumber)) ?? parts[0];
    return {
        configuration,
        partNumber: normalizeText(part?.partNumber),
        name: normalizeText(part?.name),
        description: normalizeText(part?.description),
        material: normalizeText(part?.material?.displayName),
        vendor: normalizeText(part?.vendor),
        hasMultipleParts: parts.length > 1
    };
}

/** Onshape's default display names for the metadata properties we store. */
const METADATA_FIELDS = {
    "Part number": "partNumber",
    Name: "name",
    Description: "description",
    Material: "material",
    Vendor: "vendor"
} as const;

/** Reads a metadata property value as text; materials arrive as `{displayName}`. */
function readMetadataValue(value: unknown): string | null {
    if (typeof value === "string") {
        return normalizeText(value);
    }
    if (value && typeof value === "object" && "displayName" in value) {
        return normalizeText((value as { displayName?: string }).displayName);
    }
    return null;
}

/** Builds a record from an assembly's element metadata for one configuration. */
export function parseAssemblyRecord(
    metadata: OnshapeMetadataObject,
    configuration: ParameterValues
): ConfigurationRecord {
    const record: ConfigurationRecord = {
        configuration,
        partNumber: null,
        name: null,
        description: null,
        material: null,
        vendor: null,
        hasMultipleParts: false
    };
    for (const property of metadata.properties) {
        const field =
            METADATA_FIELDS[property.name as keyof typeof METADATA_FIELDS];
        if (field) {
            record[field] = readMetadataValue(property.value);
        }
    }
    return record;
}

/**
 * Indexes an insertable's configuration records in one pass. For request
 * handlers, which have no workflow step to hang the fetches off.
 */
export async function parseConfigurationRecords(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[]
): Promise<ConfigurationRecordsResult> {
    const defaultRecord = await probeConfiguration(
        client,
        elementPath,
        elementType,
        {}
    );
    const { batches, capped } = planBatches(parameters);

    const batchRecords: ConfigurationRecord[][] = [];
    for (const batch of batches) {
        batchRecords.push(
            await fetchBatch(client, elementPath, elementType, batch)
        );
    }
    return toResult(defaultRecord, batchRecords, capped);
}

/**
 * Indexes an insertable's configuration records as part of its load, one durable
 * step per batch of configurations, so a rate-limited retry re-fetches only that
 * batch. Batches run sequentially — insertables already load in parallel, which
 * is where the concurrency comes from.
 *
 * A batch that exhausts its retries throws, failing the insertable rather than
 * saving a half-built list; the stored row keeps its previous records.
 */
export async function loadConfigurationRecords(
    ctx: LoadContext,
    insertableId: string,
    elementPath: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[]
): Promise<ConfigurationRecordsResult> {
    const defaultRecord = await ctx.step.do(
        `records-${insertableId}-default`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            probeConfiguration(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                elementType,
                {}
            )
    );
    const { batches, capped } = planBatches(parameters);

    const batchRecords: ConfigurationRecord[][] = [];
    for (const [index, batch] of batches.entries()) {
        batchRecords.push(
            await ctx.step.do(
                `records-${insertableId}-batch-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () =>
                    fetchBatch(
                        await getOnshapeApiFromContext(ctx),
                        elementPath,
                        elementType,
                        batch
                    )
            )
        );
    }
    return toResult(defaultRecord, batchRecords, capped);
}

/**
 * Splits an insertable's configuration combinations into the batches to fetch.
 *
 * An insertable with nothing to vary — no parameters, or only cosmetic, quantity,
 * and string ones — enumerates to a single empty configuration, which the default
 * probe already asked for. Dropping it leaves no batches rather than probing the
 * defaults twice.
 */
function planBatches(parameters: ConfigurationParameter[]): {
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

/** Reads the record Onshape reports for an element in a given configuration. */
async function probeConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    configuration: ParameterValues
): Promise<ConfigurationRecord> {
    if (elementType === ElementType.ASSEMBLY) {
        return parseAssemblyRecord(
            await getElementMetadata(client, elementPath, configuration),
            configuration
        );
    }
    return parsePartStudioRecord(
        await getParts(client, elementPath, configuration),
        configuration
    );
}

/** Probes each configuration in a batch. */
async function fetchBatch(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    batch: ParameterValues[]
): Promise<ConfigurationRecord[]> {
    const records: ConfigurationRecord[] = [];
    for (const configuration of batch) {
        records.push(
            await probeConfiguration(
                client,
                elementPath,
                elementType,
                configuration
            )
        );
    }
    return records;
}

/**
 * Folds the default probe and every batch into the stored result, in enumeration
 * order (the default first). `MULTIPLE_PARTS` is raised when any configuration
 * resolved to more than one part.
 */
function toResult(
    defaultRecord: ConfigurationRecord,
    batches: ConfigurationRecord[][],
    capped: boolean
): ConfigurationRecordsResult {
    const records = [defaultRecord, ...batches.flat()];

    let buildIssues: BuildIssue[] = [];
    if (capped) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.TOO_MANY_CONFIGURATIONS
        });
    }
    if (records.some((record) => record.hasMultipleParts)) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.MULTIPLE_PARTS
        });
    }

    return { records, buildIssues };
}
