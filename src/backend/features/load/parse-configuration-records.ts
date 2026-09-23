/**
 * Probes an insertable's configurations for the metadata we store. Every probe
 * is kept: search dedupes itself, and build checks read the ones it drops.
 */
import { OnshapeApi } from "../../lib/onshape/client";
import { parseRecordVendor } from "./parse-vendors";
import { ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    type PartialSelection,
    type PartMetadata
} from "../configurations/contract";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    toConfigurationIssue
} from "../build-checker/issues";
import {
    countConfigurations,
    effectiveExclusions,
    IndexingBand,
    isIndexingEnabled
} from "../configurations/combinations";
import { onshapeOverrides, toSelection } from "../configurations/selection";
import { getParts } from "../../lib/onshape/endpoints/parts";
import { getElementMetadata } from "../../lib/onshape/endpoints/metadata";
import type {
    OnshapeMetadataObject,
    OnshapePart
} from "../../lib/onshape/types";
import { clean } from "../../lib/text";

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
    BuildIssueType.CONFIGURATION_MULTIPLE_PARTS,
    BuildIssueType.UNSTABLE_COMPOSITE
];

/** Whether to index an insertable, and how to flag it if we don't. */
interface IndexingDecision {
    /** Index below the threshold, or above it when an admin enabled it. */
    shouldIndex: boolean;
    /** The limit issues this decision raises, if any. */
    buildIssues: BuildIssue[];
    /** The combinations to probe, already enumerated by the count. */
    configurations: PartialSelection[];
}

/** What an admin decided about indexing an insertable. */
export interface IndexingSettings {
    /** Index even past the automatic threshold. */
    indexConfigurations: boolean;
    excludedParameterIds: string[];
}

/** Past the hard cap forcing it on cannot help, since enumeration stops there. */
export function decideIndexing(
    elementType: ElementType,
    parameters: ConfigurationParameter[],
    settings: IndexingSettings
): IndexingDecision {
    const { indexConfigurations } = settings;
    const { band, configurations } = countConfigurations(
        parameters,
        effectiveExclusions(elementType, settings.excludedParameterIds)
    );
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

/** What a part studio's parts resolve to, before build issues are decided. */
interface PartsEvaluation {
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
function evaluateParts(parts: OnshapePart[]): PartsEvaluation {
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
    values: PartialSelection,
    isOpenComposite: boolean
): ConfigurationRecord {
    const evaluation = evaluateParts(parts);
    // An element that is an open composite everywhere else has no part to read
    // in a configuration that loses it; toResult raises the build issue.
    if (isOpenComposite && !evaluation.isOpenComposite) {
        return {
            values,
            hasMultipleParts: false,
            isOpenComposite: false
        };
    }
    const part = evaluation.partToUse;
    return {
        values,
        partNumber: clean(part?.partNumber),
        name: clean(part?.name),
        description: clean(part?.description),
        material: clean(part?.material?.displayName),
        vendor: clean(part?.vendor),
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
        return clean(value);
    }
    if (value && typeof value === "object" && "displayName" in value) {
        return clean((value as { displayName?: string }).displayName);
    }
    return undefined;
}

/** Builds a record from an assembly's element metadata for one configuration. */
export function parseAssemblyRecord(
    metadata: OnshapeMetadataObject,
    values: PartialSelection
): ConfigurationRecord {
    // An assembly is never a composite, so it reads nothing about one.
    const record: ConfigurationRecord = {
        values,
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

/** The element a probe reads, carried together rather than threaded apart. */
export interface ProbeTarget {
    elementPath: ElementPath;
    elementType: ElementType;
    isOpenComposite: boolean;
}

/**
 * How one Onshape read is run. A request awaits it directly; a load wraps each
 * in a durable step (`loadConfigurationRecords`), so a rate-limited retry
 * re-fetches only that batch.
 * The client is fetched per read rather than held, since a step that retries
 * hours later needs a token that has not expired.
 */
export type ProbeRunner = (
    name: string,
    read: () => Promise<ConfigurationRecord[]>
) => Promise<ConfigurationRecord[]>;

export async function indexRecords(
    getClient: () => Promise<OnshapeApi>,
    run: ProbeRunner,
    target: ProbeTarget,
    parameters: ConfigurationParameter[],
    configurations: PartialSelection[]
): Promise<ConfigurationRecordsResult> {
    // The element's own defaults, probed as a batch of one so every read the
    // runner sees has the same shape.
    const [defaultRecord] = await run("default", async () =>
        fetchBatch(await getClient(), target, parameters, [{}])
    );
    const batches = planBatches(configurations, parameters);

    const batchRecords: ConfigurationRecord[][] = [];
    for (const [index, batch] of batches.entries()) {
        batchRecords.push(
            await run(`batch-${index}`, async () =>
                fetchBatch(await getClient(), target, parameters, batch)
            )
        );
    }
    return toResult(defaultRecord, batchRecords, parameters);
}

/** For request handlers, which have no workflow step to hang the fetches off. */
export function parseConfigurationRecords(
    client: OnshapeApi,
    target: ProbeTarget,
    parameters: ConfigurationParameter[],
    configurations: PartialSelection[]
): Promise<ConfigurationRecordsResult> {
    return indexRecords(
        () => Promise.resolve(client),
        (_name, read) => read(),
        target,
        parameters,
        configurations
    );
}

/**
 * Splits the combinations to fetch into batches, minus anything the separate
 * default probe already covers.
 */
function planBatches(
    configurations: PartialSelection[],
    parameters: ConfigurationParameter[]
): PartialSelection[][] {
    // A combination overriding nothing is the default probe again, so drop
    // every all-defaults one, not just the empty one.
    const toFetch = configurations.filter(
        (values) => Object.keys(overridesOf(values, parameters)).length > 0
    );

    const batches: PartialSelection[][] = [];
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        batches.push(toFetch.slice(i, i + BATCH_SIZE));
    }
    return batches;
}

/** What enumerated values change from the element's defaults. */
function overridesOf(
    values: PartialSelection,
    parameters: ConfigurationParameter[]
) {
    return onshapeOverrides(toSelection(values, parameters), parameters);
}

/** Reads the record Onshape reports for an element in one configuration. */
async function probeConfiguration(
    client: OnshapeApi,
    target: ProbeTarget,
    parameters: ConfigurationParameter[],
    values: PartialSelection
): Promise<ConfigurationRecord> {
    const { elementPath, elementType, isOpenComposite } = target;
    const configuration = overridesOf(values, parameters);
    if (elementType === ElementType.ASSEMBLY) {
        return parseAssemblyRecord(
            await getElementMetadata(client, elementPath, configuration),
            values
        );
    }
    return parsePartStudioRecord(
        await getParts(client, elementPath, configuration),
        values,
        isOpenComposite
    );
}

/** Probes each configuration in a batch. */
async function fetchBatch(
    client: OnshapeApi,
    target: ProbeTarget,
    parameters: ConfigurationParameter[],
    batch: PartialSelection[]
): Promise<ConfigurationRecord[]> {
    const records: ConfigurationRecord[] = [];
    for (const values of batch) {
        records.push(
            await probeConfiguration(client, target, parameters, values)
        );
    }
    return records;
}

/** Onshape's vendor when a part carries one, otherwise the parsed one. */
function resolveVendor(
    record: ConfigurationRecord,
    parameters: ConfigurationParameter[]
): string | undefined {
    return (
        record.vendor ??
        parseRecordVendor(record.name, record.values, parameters)
    );
}

/** Folds the default probe and every batch together, the default first. */
function toResult(
    defaultRecord: ConfigurationRecord,
    batches: ConfigurationRecord[][],
    parameters: ConfigurationParameter[]
): ConfigurationRecordsResult {
    // The element's own probe describes the element, not a configuration of it,
    // so it sheds the (empty) values that produced it.
    const partMetadata: PartMetadata = {
        partNumber: defaultRecord.partNumber,
        name: defaultRecord.name,
        description: defaultRecord.description,
        material: defaultRecord.material,
        vendor: resolveVendor(defaultRecord, parameters),
        hasMultipleParts: defaultRecord.hasMultipleParts,
        isOpenComposite: defaultRecord.isOpenComposite
    };

    const records: ConfigurationRecord[] = batches.flat().map((record) => ({
        ...record,
        vendor: resolveVendor(record, parameters)
    }));

    // A capped insertable never reaches here: decideIndexing turns indexing off
    // past the cap, and raises CONFIGURATION_LIMIT_EXCEEDED itself.
    let buildIssues: BuildIssue[] = [];

    // Which probe fails decides whose problem it is. The element's own defaults
    // failing is the part being wrong, and every configuration inherits it, so
    // there is nothing narrower to report; a configuration failing where the
    // defaults hold is that configuration's problem, and can be opened.
    if (partMetadata.hasMultipleParts) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.MULTIPLE_PARTS
        });
    } else {
        const offenders = records.filter((record) => record.hasMultipleParts);
        if (offenders.length > 0) {
            buildIssues = addBuildIssue(
                buildIssues,
                toConfigurationIssue(
                    BuildIssueType.CONFIGURATION_MULTIPLE_PARTS,
                    offenders
                )
            );
        }
    }

    // The element's own probe sets the expectation; losing the composite in any
    // configuration is what makes it unstable.
    if (partMetadata.isOpenComposite) {
        const offenders = records.filter((record) => !record.isOpenComposite);
        if (offenders.length > 0) {
            buildIssues = addBuildIssue(
                buildIssues,
                toConfigurationIssue(
                    BuildIssueType.UNSTABLE_COMPOSITE,
                    offenders
                )
            );
        }
    }

    return { partMetadata, records, buildIssues };
}
