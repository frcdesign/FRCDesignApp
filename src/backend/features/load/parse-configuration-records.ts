/**
 * Probes an insertable's configurations for the metadata we store. Every probe
 * is kept: search dedupes itself, and build checks read the ones it drops.
 */
import { OnshapeApi } from "../../lib/onshape/client";
import { ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    ParameterValues,
    ConfigurationParameter,
    PartMetadata,
    ConfigurationRecord
} from "../configurations/models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../build-checker/issues";
import {
    countConfigurations,
    IndexingBand,
    isIndexingEnabled
} from "../configurations/combinations";
import { canonicalizeConfiguration } from "../configurations/canonical";
import { getParts } from "../../lib/onshape/endpoints/parts";
import { getElementMetadata } from "../../lib/onshape/endpoints/metadata";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../../lib/onshape/types";
import { type LoadContext, getOnshapeApiFromContext } from "./context";
import { ONSHAPE_STEP_RETRIES } from "./steps";

/** Configurations fetched per workflow step. */
const BATCH_SIZE = 20;

/** An insertable's configuration records, and the issues indexing them raised. */
export interface ConfigurationRecordsResult {
    /** The element's own part data; null when nothing was probed. */
    partMetadata: PartMetadata | null;
    /** One per indexed configuration; the element's own is `partMetadata`. */
    records: ConfigurationRecord[];
    buildIssues: BuildIssue[];
}

/** The result for an insertable that isn't indexed. */
export const NO_RECORDS: ConfigurationRecordsResult = {
    partMetadata: null,
    records: [],
    buildIssues: []
};

/**
 * The issue types indexing owns. A caller merging a fresh result into stored
 * issues clears these first, so a resolved issue doesn't stick around.
 */
export const INDEXING_ISSUE_TYPES = [
    BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED,
    BuildIssueType.MANUAL_INDEXING_REQUIRED,
    BuildIssueType.MULTIPLE_PARTS,
    BuildIssueType.UNSTABLE_COMPOSITE,
    BuildIssueType.NO_PART_NUMBER
];

/** Whether to index an insertable, and how to flag it if we don't. */
export interface IndexingDecision {
    /** Index below the threshold, or above it when an admin enabled it. */
    shouldIndex: boolean;
    /** The limit issues this decision raises, if any. */
    buildIssues: BuildIssue[];
    /** The combinations to probe, already enumerated by the count. */
    configurations: ParameterValues[];
}

/** Past the hard cap forcing it on cannot help, since enumeration stops there. */
export function decideIndexing(
    parameters: ConfigurationParameter[],
    indexConfigurations: boolean
): IndexingDecision {
    const { band, configurations } = countConfigurations(parameters);
    const shouldIndex = isIndexingEnabled(band, indexConfigurations);

    if (band === IndexingBand.EXCEEDED) {
        return {
            shouldIndex,
            buildIssues: [
                { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }
            ],
            configurations
        };
    }
    if (band === IndexingBand.MANUAL && !indexConfigurations) {
        return {
            shouldIndex,
            buildIssues: [{ type: BuildIssueType.MANUAL_INDEXING_REQUIRED }],
            configurations
        };
    }
    return { shouldIndex, buildIssues: [], configurations };
}

/** Trims a raw metadata value; a missing or blank one becomes `null`. */
function normalizeText(value: string | undefined | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

/** What a part studio's parts resolve to, before build issues are decided. */
export interface PartsEvaluation {
    /** True when more than one part could be the one to index. */
    hasMultipleParts: boolean;
    /** True when the studio is an open composite (see {@link computeOpenComposite}). */
    isOpenComposite: boolean;
    /** The part whose record to read, or `undefined` when there are none. */
    partToUse: OnshapePart | undefined;
}

/**
 * The one place that reads meaning out of a `/parts` response. A studio holds
 * one part; an open composite is the exception, and its constituents are ignored.
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

/** Stable across configurations, so it is computed once from the default. */
export function computeOpenComposite(parts: OnshapePart[]): boolean {
    return evaluateParts(parts).isOpenComposite;
}

/**
 * Reads the studio's single part, or its composite when open. A configuration
 * that loses the composite its default has stores no part at all.
 */
export function parsePartStudioRecord(
    parts: OnshapePart[],
    configuration: ParameterValues,
    isOpenComposite: boolean
): ConfigurationRecord {
    const evaluation = evaluateParts(parts);
    // An element that is an open composite everywhere else has no part to read
    // in a configuration that loses it; toResult raises the build issue.
    if (isOpenComposite && !evaluation.isOpenComposite) {
        return {
            configuration,
            hasMultipleParts: false,
            isOpenComposite: false
        };
    }
    const part = evaluation.partToUse;
    return {
        configuration,
        partNumber: normalizeText(part?.partNumber),
        name: normalizeText(part?.name),
        description: normalizeText(part?.description),
        material: normalizeText(part?.material?.displayName),
        vendor: normalizeText(part?.vendor),
        hasMultipleParts: evaluation.hasMultipleParts,
        isOpenComposite: evaluation.isOpenComposite
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
function readMetadataValue(value: unknown): string | undefined {
    if (typeof value === "string") {
        return normalizeText(value);
    }
    if (value && typeof value === "object" && "displayName" in value) {
        return normalizeText((value as { displayName?: string }).displayName);
    }
    return undefined;
}

/** Builds a record from an assembly's element metadata for one configuration. */
export function parseAssemblyRecord(
    metadata: OnshapeMetadataObject,
    configuration: ParameterValues
): ConfigurationRecord {
    // An assembly is never a composite, so it reads nothing about one.
    const record: ConfigurationRecord = {
        configuration,
        hasMultipleParts: false,
        isOpenComposite: false
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
    parameters: ConfigurationParameter[],
    configurations: ParameterValues[],
    isOpenComposite: boolean
): Promise<ConfigurationRecordsResult> {
    const defaultRecord = await probeConfiguration(
        client,
        elementPath,
        elementType,
        {},
        isOpenComposite
    );
    const batches = planBatches(configurations, parameters);

    const batchRecords: ConfigurationRecord[][] = [];
    for (const batch of batches) {
        batchRecords.push(
            await fetchBatch(
                client,
                elementPath,
                elementType,
                batch,
                isOpenComposite
            )
        );
    }
    return toResult(defaultRecord, batchRecords, parameters);
}

/**
 * One durable step per batch, so a rate-limited retry re-fetches only that
 * batch. An exhausted batch throws rather than saving a half-built list.
 */
export async function loadConfigurationRecords(
    ctx: LoadContext,
    insertableId: string,
    elementPath: ElementPath,
    elementType: ElementType,
    parameters: ConfigurationParameter[],
    configurations: ParameterValues[],
    isOpenComposite: boolean
): Promise<ConfigurationRecordsResult> {
    const defaultRecord = await ctx.step.do(
        `records-${insertableId}-default`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            probeConfiguration(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                elementType,
                {},
                isOpenComposite
            )
    );
    const batches = planBatches(configurations, parameters);

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
                        batch,
                        isOpenComposite
                    )
            )
        );
    }
    return toResult(defaultRecord, batchRecords, parameters);
}

/**
 * Splits the combinations to fetch into batches, minus anything the separate
 * default probe already covers.
 */
function planBatches(
    configurations: ParameterValues[],
    parameters: ConfigurationParameter[]
): ParameterValues[][] {
    // Canonicalizing to the default means landing on the default probe's record,
    // so drop every all-defaults combination, not just the empty one.
    const toFetch = configurations.filter(
        (configuration) =>
            Object.keys(canonicalizeConfiguration(configuration, parameters))
                .length > 0
    );

    const batches: ParameterValues[][] = [];
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        batches.push(toFetch.slice(i, i + BATCH_SIZE));
    }
    return batches;
}

/** Reads the record Onshape reports for an element in a given configuration. */
async function probeConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    configuration: ParameterValues,
    isOpenComposite: boolean
): Promise<ConfigurationRecord> {
    if (elementType === ElementType.ASSEMBLY) {
        return parseAssemblyRecord(
            await getElementMetadata(client, elementPath, configuration),
            configuration
        );
    }
    return parsePartStudioRecord(
        await getParts(client, elementPath, configuration),
        configuration,
        isOpenComposite
    );
}

/** Probes each configuration in a batch. */
async function fetchBatch(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    batch: ParameterValues[],
    isOpenComposite: boolean
): Promise<ConfigurationRecord[]> {
    const records: ConfigurationRecord[] = [];
    for (const configuration of batch) {
        records.push(
            await probeConfiguration(
                client,
                elementPath,
                elementType,
                configuration,
                isOpenComposite
            )
        );
    }
    return records;
}

/** Folds the default probe and every batch together, the default first. */
function toResult(
    defaultRecord: ConfigurationRecord,
    batches: ConfigurationRecord[][],
    parameters: ConfigurationParameter[]
): ConfigurationRecordsResult {
    // The element's own probe describes the element, not a configuration of it,
    // so it sheds the (empty) configuration that produced it.
    const partMetadata: PartMetadata = {
        partNumber: defaultRecord.partNumber,
        name: defaultRecord.name,
        description: defaultRecord.description,
        material: defaultRecord.material,
        vendor: defaultRecord.vendor,
        hasMultipleParts: defaultRecord.hasMultipleParts,
        isOpenComposite: defaultRecord.isOpenComposite
    };

    // Canonical, so a record addresses the same thumbnail the insert menu does
    // for the same selection.
    const records = batches.flat().map((record) => ({
        ...record,
        configuration: canonicalizeConfiguration(
            record.configuration,
            parameters
        )
    }));

    // A capped insertable never reaches here: decideIndexing turns indexing off
    // past the cap, and raises CONFIGURATION_LIMIT_EXCEEDED itself.
    const probes: PartMetadata[] = [partMetadata, ...records];
    let buildIssues: BuildIssue[] = [];
    if (probes.some((probe) => probe.hasMultipleParts)) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.MULTIPLE_PARTS
        });
    }
    // The element's own probe sets the expectation; losing the composite in any
    // configuration is what makes it unstable.
    if (
        partMetadata.isOpenComposite &&
        probes.some((probe) => !probe.isOpenComposite)
    ) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.UNSTABLE_COMPOSITE
        });
    }

    return { partMetadata, records, buildIssues };
}
