import { NonRetryableError } from "cloudflare:workflows";
import { eq } from "drizzle-orm";
import { generatedFeatures } from "../generated-parts/store";
import { type Db, getDb } from "../../db/client";
import {
    type Configuration,
    type PartMetadata,
    type ConfigurationParameter,
    type PartialSelection
} from "../configurations/contract";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    hasBuildIssue
} from "../build-checker/issues";
import { ElementType } from "../../lib/onshape/element-type";
import type { IndexingSettings } from "../build-checker/contract";
import type { FastenInfo } from "../library/insertables/fasten";
import type { ThumbnailUrls } from "../thumbnails/contract";
import type { Vendor } from "../library/vendors";
import { configurations, insertables } from "../../db/schema";
import { uploadThumbnails } from "../thumbnails/store";
import { getConfiguration } from "../../lib/onshape/endpoints/configurations";
import { getParts } from "../../lib/onshape/endpoints/parts";
import { checkInsertable } from "../build-checker/checks";
import { generatedConfiguration } from "../generated-parts/records";
import {
    type GeneratedFeature,
    GeneratedManifestError,
    type GeneratedTab,
    parseManifest,
    releasedStudio,
    type ReleasedStudio
} from "../generated-parts/manifest";
import { getBlobText } from "../../lib/onshape/endpoints/blob-elements";
import { parseOnshapeConfiguration } from "./parse-configuration";
import { parseVendors } from "./parse-vendors";
import {
    decideFasten,
    findMateConnector,
    type MateConnector
} from "./parse-fasten";
import {
    NO_RECORDS,
    computeOpenComposite,
    decideIndexing,
    indexRecords,
    type ConfigurationRecordsResult,
    type ProbeTarget
} from "./parse-configuration-records";
import {
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./context";
import { ONSHAPE_STEP_RETRIES, uploadThumbnailsStep } from "./steps";

/** The columns a reload overwrites; the rest is identity or user-owned. */
export interface ParsedInsertable {
    vendors: Vendor[];
    thumbnailUrls: ThumbnailUrls | null;
    fastenInfo: FastenInfo | null;
    /** Whether the part studio resolves to an open composite. */
    isOpenComposite: boolean;
    buildIssues: BuildIssue[];
    /** The element's own part data; null when nothing was probed. */
    partMetadata: PartMetadata | null;
    configuration: Configuration;
    /** Whether it's a Part Studio robot-code generates, rather than one modeled by hand. */
    isGenerated: boolean;
}

/** The user-owned flags that decide how much of a load runs. */
interface InsertableFlags extends IndexingSettings {
    fastenDisabled: boolean;
}

/** Every Onshape call but the thumbnail's, all under the limiter. */
interface ProbedInsertable {
    vendors: Vendor[];
    fastenInfo: FastenInfo | null;
    isOpenComposite: boolean;
    /** Whether there is anything for Onshape to render. */
    hasParts: boolean;
    partMetadata: PartMetadata | null;
    configuration: Configuration;
    isGenerated: boolean;
    /** Everything raised so far; the thumbnail check adds its own. */
    buildIssues: BuildIssue[];
}

export async function loadInsertable(
    ctx: LoadContext,
    target: InsertableTarget
): Promise<void> {
    const { insertableId } = target;

    // Limited here since an indexed element probes once per configuration.
    const probed = await ctx.limit(() => probeInsertable(ctx, target));

    // Nothing is asked for an empty studio, which renders to nothing at all.
    const thumbnailUrls = probed.hasParts
        ? await uploadThumbnailsStep(
              ctx,
              `thumbnail-${insertableId}`,
              async () =>
                  uploadThumbnails(
                      ctx.env.BLOB,
                      await getOnshapeApiFromContext(ctx),
                      target.elementPath,
                      target.elementWorkspacePath,
                      target.microversionId
                  )
          )
        : null;

    const parsed: ParsedInsertable = {
        vendors: probed.vendors,
        thumbnailUrls,
        fastenInfo: probed.fastenInfo,
        isOpenComposite: probed.isOpenComposite,
        buildIssues: addBuildIssue(
            probed.hasParts
                ? checkInsertable({ vendors: probed.vendors, thumbnailUrls })
                : [],
            ...probed.buildIssues
        ),
        partMetadata: probed.partMetadata,
        configuration: probed.configuration,
        isGenerated: probed.isGenerated
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), target, parsed)
    );
}

/** Reads everything about an insertable that asking Onshape can answer at once. */
async function probeInsertable(
    ctx: LoadContext,
    target: InsertableTarget
): Promise<ProbedInsertable> {
    const { insertableId, elementPath } = target;

    const flags = await readFlagsStep(ctx, target);

    const parameters = await parseConfigurationStep(ctx, target);

    // Its records are robot-code's, released with its configuration
    const released = target.generated
        ? await readReleasedStudioStep(ctx, target, target.generated)
        : undefined;
    const generated =
        released && generatedConfiguration(parameters, released.records);

    const vendors = generated
        ? generated.vendors
        : parseVendors(target.name, parameters);

    const fasten = decideFasten(
        flags.fastenDisabled
            ? undefined
            : ((await findMateConnectorStep(
                  ctx,
                  target,
                  released && {
                      elementId: elementPath.elementId,
                      type: released.feature,
                      mateConnector: released.mateConnector
                  }
              )) ?? undefined)
    );

    const parts = await readPartsStep(ctx, target);
    const { isOpenComposite } = parts;
    const hasParts = !hasBuildIssue(parts.buildIssues, BuildIssueType.NO_PARTS);

    // A generated studio indexes every configuration, whatever its count or the admin's settings
    const indexing = generated
        ? { shouldIndex: false, configurations: [], buildIssues: [] }
        : decideIndexing(parameters, flags);

    const recordsResult = generated
        ? { ...generated, buildIssues: [] }
        : indexing.shouldIndex
          ? await loadConfigurationRecords(
                ctx,
                insertableId,
                {
                    elementPath,
                    elementType: target.elementType,
                    isOpenComposite
                },
                parameters,
                indexing.configurations
            )
          : NO_RECORDS;

    return {
        vendors,
        fastenInfo: fasten.fastenInfo,
        isOpenComposite,
        hasParts,
        partMetadata: recordsResult.partMetadata,
        configuration: { parameters, records: recordsResult.records },
        isGenerated: released !== undefined,
        buildIssues: addBuildIssue(
            hasParts ? [] : parts.buildIssues,
            ...recordsResult.buildIssues,
            ...indexing.buildIssues,
            ...fasten.buildIssues
        )
    };
}

/** Its studio's part of the manifest released beside it, as a step returns at most 1 MiB. */
function readReleasedStudioStep(
    ctx: LoadContext,
    target: InsertableTarget,
    generated: GeneratedTab
): Promise<ReleasedStudio> {
    return ctx.step.do(
        `generated-${target.insertableId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () => {
            const text = await getBlobText(
                await getOnshapeApiFromContext(ctx),
                {
                    ...target.elementPath,
                    elementId: generated.manifestElementId
                }
            );
            return nonRetryable(() =>
                releasedStudio(
                    parseManifest(text, `${generated.set}'s manifest`),
                    generated
                )
            );
        }
    );
}

/** Runs `read` in a step, failing it at once on a manifest it can't read, which every retry would read the same. */
export function nonRetryable<T>(read: () => T): T {
    try {
        return read();
    } catch (error) {
        if (error instanceof GeneratedManifestError) {
            throw new NonRetryableError(error.message);
        }
        throw error;
    }
}

/** A new insertable has no row, so it gets the defaults the save writes. */
function readFlagsStep(
    ctx: LoadContext,
    { insertableId, generated }: InsertableTarget
): Promise<InsertableFlags> {
    return ctx.step.do(`flags-${insertableId}`, async () => {
        const row = await getDb(ctx.env.DB)
            .select({
                fastenDisabled: insertables.fastenDisabled,
                indexConfigurations: insertables.indexConfigurations,
                excludedParameterIds: insertables.excludedParameterIds
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        const flags = row ?? {
            fastenDisabled: false,
            indexConfigurations: false,
            excludedParameterIds: []
        };
        // A generated studio's part makes a mate connector, and always fastens
        return generated ? { ...flags, fastenDisabled: false } : flags;
    });
}

function parseConfigurationStep(
    ctx: LoadContext,
    { insertableId, elementPath }: InsertableTarget
): Promise<ConfigurationParameter[]> {
    return ctx.step.do(
        `config-${insertableId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () => {
            const onshapeConfiguration = await getConfiguration(
                await getOnshapeApiFromContext(ctx),
                elementPath
            );
            return parseOnshapeConfiguration(onshapeConfiguration);
        }
    );
}

/** What one look at a part studio's default parts tells the rest of the load. */
interface PartsSummary {
    isOpenComposite: boolean;
    /** NO_PARTS when the studio is empty; the rest of the load reads it. */
    buildIssues: BuildIssue[];
}

/** Every load, so inserts always ask for the right part types. */
function readPartsStep(
    ctx: LoadContext,
    { insertableId, elementPath, elementType }: InsertableTarget
): Promise<PartsSummary> {
    if (elementType !== ElementType.PART_STUDIO) {
        return Promise.resolve({ isOpenComposite: false, buildIssues: [] });
    }
    return ctx.step.do(
        `parts-${insertableId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async (): Promise<PartsSummary> => {
            const parts = await getParts(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                {}
            );
            return {
                isOpenComposite: computeOpenComposite(parts),
                buildIssues:
                    parts.length > 0 ? [] : [{ type: BuildIssueType.NO_PARTS }]
            };
        }
    );
}

/**
 * Null when there is none: a step's result can't be undefined. `ownFeature`: a
 * generated studio's feature, which its own load knows before any set naming it
 * is stored.
 */
function findMateConnectorStep(
    ctx: LoadContext,
    { insertableId, elementPath, elementType }: InsertableTarget,
    ownFeature: GeneratedFeature | undefined
): Promise<MateConnector | null> {
    return ctx.step.do(
        `fasten-${insertableId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            (await findMateConnector(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                elementType,
                [
                    ...(await generatedFeatures(getDb(ctx.env.DB))),
                    ...(ownFeature ? [ownFeature] : [])
                ]
            )) ?? null
    );
}

/**
 * Only `parsed` is overwritten, so a reload keeps the user's flags. Sort order
 * is maintained by the group's save, which knows the tab order.
 */
export async function saveInsertable(
    db: Db,
    target: InsertableTarget,
    parsed: ParsedInsertable
): Promise<void> {
    const configuration = parsed.configuration;
    const reloaded = {
        name: target.name,
        elementType: target.elementType,
        microversionId: target.microversionId,
        versionId: target.elementPath.instanceId,
        versionCreatedAt: target.versionCreatedAt,
        vendors: parsed.vendors,
        smallThumbnailUrl: parsed.thumbnailUrls?.small ?? null,
        largeThumbnailUrl: parsed.thumbnailUrls?.large ?? null,
        fastenInfo: parsed.fastenInfo,
        isOpenComposite: parsed.isOpenComposite,
        partMetadata: parsed.partMetadata,
        isGenerated: parsed.isGenerated,
        buildIssues: parsed.buildIssues,
        lastLoadedAt: new Date(),
        // Not an editor's to change: a generated part fastens
        ...(target.generated !== undefined && { fastenDisabled: false })
    };

    const insertableWrite = db
        .insert(insertables)
        .values({
            id: target.insertableId,
            libraryId: target.libraryId,
            groupId: target.groupId,
            documentId: target.elementPath.documentId,
            elementId: target.elementPath.elementId,
            sortOrder: target.sortOrder,
            // Only on insert, so an existing row keeps the user's choices.
            isVisible: false,
            indexConfigurations: false,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: insertables.id,
            set: reloaded
        });

    // A configurations row exists exactly when the insertable is configurable.
    let configurationWrite;
    if (configuration.parameters.length > 0) {
        configurationWrite = db
            .insert(configurations)
            .values({ insertableId: target.insertableId, ...configuration })
            .onConflictDoUpdate({
                target: configurations.insertableId,
                set: configuration
            });
    } else {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.insertableId, target.insertableId));
    }

    await db.batch([insertableWrite, configurationWrite]);
}

/** One durable step per batch. An exhausted batch throws rather than save a partial list. */
function loadConfigurationRecords(
    ctx: LoadContext,
    insertableId: string,
    target: ProbeTarget,
    parameters: ConfigurationParameter[],
    configurations: PartialSelection[]
): Promise<ConfigurationRecordsResult> {
    return indexRecords(
        () => getOnshapeApiFromContext(ctx),
        (name, read) =>
            ctx.step.do(
                `records-${insertableId}-${name}`,
                { retries: ONSHAPE_STEP_RETRIES },
                read
            ),
        target,
        parameters,
        configurations
    );
}
