import { eq } from "drizzle-orm";
import { type Db, getDb } from "../../db/client";
import type {
    Configuration,
    PartMetadata,
    ConfigurationParameter
} from "../configurations/contract";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    hasBuildIssue
} from "../build-checker/issues";
import { ElementType } from "../../lib/onshape/element-type";
import type { FastenInfo } from "../library/insertables/fasten";
import type { ThumbnailUrls } from "../thumbnails/contract";
import type { Vendor } from "../library/vendors";
import { configurations, insertables } from "../../db/schema";
import { uploadThumbnails } from "../thumbnails/store";
import { getConfiguration } from "../../lib/onshape/endpoints/configurations";
import { getParts } from "../../lib/onshape/endpoints/parts";
import { checkInsertable } from "../build-checker/checks";
import { parseOnshapeConfiguration } from "./parse-configuration";
import { parseVendors } from "./parse-vendors";
import { parseFastenInfo } from "./parse-fasten";
import {
    NO_RECORDS,
    computeOpenComposite,
    decideIndexing,
    loadConfigurationRecords
} from "./parse-configuration-records";
import {
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./context";
import { ONSHAPE_STEP_RETRIES, uploadThumbnailsStep } from "./steps";

/**
 * Exactly the columns a reload overwrites; the rest of the row is identity or
 * user-owned.
 */
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
}

/** The user-owned flags that decide how much of a load runs. */
interface InsertableFlags {
    supportsFasten: boolean;
    /** Forces part-number indexing on, overriding the auto heuristic. */
    indexConfigurations: boolean;
}

/**
 * What a load reads under the limiter: every Onshape call an insertable makes
 * except the thumbnail's.
 */
interface ProbedInsertable {
    vendors: Vendor[];
    fastenInfo: FastenInfo | null;
    isOpenComposite: boolean;
    /** Whether there is anything for Onshape to render. */
    hasParts: boolean;
    partMetadata: PartMetadata | null;
    configuration: Configuration;
    /** Everything raised so far; the thumbnail check adds its own. */
    buildIssues: BuildIssue[];
}

export async function loadInsertable(
    ctx: LoadContext,
    target: InsertableTarget
): Promise<void> {
    const { insertableId, elementPath } = target;

    // Bounded, because this is where an insertable's Onshape calls are: an
    // indexed element probes once per configuration.
    const probed = await ctx.limit(() => probeInsertable(ctx, target));

    // Fetched here rather than queued: an element's own thumbnail is one
    // Onshape already rendered when the document was saved, so reading it
    // starts nothing and races nothing. Only a configuration has to queue.
    //
    // Nothing is asked for an empty studio, which renders to nothing at all.
    const thumbnailUrls = probed.hasParts
        ? await uploadThumbnailsStep(
              ctx,
              `thumbnail-${insertableId}`,
              async () =>
                  uploadThumbnails(
                      ctx.env.BLOB,
                      await getOnshapeApiFromContext(ctx),
                      elementPath,
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
        configuration: probed.configuration
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

    const flags = await readFlagsStep(ctx, insertableId);

    const parameters = await parseConfigurationStep(ctx, target);

    const vendors = parseVendors(target.name, parameters);

    const fastenInfo = flags.supportsFasten
        ? await parseFastenInfoStep(ctx, target)
        : null;

    const parts = await readPartsStep(ctx, target);
    const { isOpenComposite } = parts;
    // An empty studio renders nothing and probes to nothing, so what it raises
    // decides how much of the rest of the load is worth running.
    const hasParts = !hasBuildIssue(parts.buildIssues, BuildIssueType.NO_PARTS);

    const indexing = decideIndexing(
        target.elementType,
        parameters,
        flags.indexConfigurations
    );

    const recordsResult = indexing.shouldIndex
        ? await loadConfigurationRecords(
              ctx,
              insertableId,
              { elementPath, elementType: target.elementType, isOpenComposite },
              parameters,
              indexing.configurations
          )
        : NO_RECORDS;

    return {
        vendors,
        fastenInfo,
        isOpenComposite,
        hasParts,
        partMetadata: recordsResult.partMetadata,
        configuration: { parameters, records: recordsResult.records },
        buildIssues: addBuildIssue(
            hasParts ? [] : parts.buildIssues,
            ...recordsResult.buildIssues,
            ...indexing.buildIssues
        )
    };
}

/**
 * Reads the flags that decide how much of the load runs. A brand-new insertable
 * has no row yet, so it gets the same defaults the save writes.
 */
function readFlagsStep(
    ctx: LoadContext,
    insertableId: string
): Promise<InsertableFlags> {
    return ctx.step.do(`flags-${insertableId}`, async () => {
        const row = await getDb(ctx.env.DB)
            .select({
                supportsFasten: insertables.supportsFasten,
                indexConfigurations: insertables.indexConfigurations
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        return row ?? { supportsFasten: false, indexConfigurations: false };
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

/**
 * Runs on every load, not just under indexing, so the insert path always asks
 * for the right part types. Assemblies have nothing to read, so they skip it.
 */
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
        async () => {
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

function parseFastenInfoStep(
    ctx: LoadContext,
    { insertableId, elementPath, elementType }: InsertableTarget
): Promise<FastenInfo> {
    return ctx.step.do(
        `fasten-${insertableId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            parseFastenInfo(
                await getOnshapeApiFromContext(ctx),
                elementPath,
                elementType
            )
    );
}

/**
 * Everything outside `parsed` is written only on insert, so a reload preserves
 * sort order and the user's flags.
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
        vendors: parsed.vendors,
        smallThumbnailUrl: parsed.thumbnailUrls?.small ?? null,
        largeThumbnailUrl: parsed.thumbnailUrls?.large ?? null,
        fastenInfo: parsed.fastenInfo,
        isOpenComposite: parsed.isOpenComposite,
        partMetadata: parsed.partMetadata,
        buildIssues: parsed.buildIssues,
        lastLoadedAt: new Date()
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
            // A new insertable starts hidden with its features off. An existing
            // one keeps the user's choices, since `set` omits these.
            isVisible: false,
            supportsFasten: false,
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
