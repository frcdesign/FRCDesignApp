import { eq } from "drizzle-orm";
import { type Db, getDb } from "../../db/client";
import type {
    Configuration,
    ConfigurationParameter
} from "../configurations/models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../build-checker/issues";
import { ElementType } from "../../lib/onshape/element-type";
import type { FastenInfo } from "../library/insertables/fasten";
import type { ThumbnailUrls } from "../thumbnails/types";
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
import { uploadThumbnailsStep } from "./steps";

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
    configuration: Configuration;
}

/** The user-owned flags that decide how much of a load runs. */
interface InsertableFlags {
    supportsFasten: boolean;
    /** Forces part-number indexing on, overriding the auto heuristic. */
    indexConfigurations: boolean;
}

export async function loadInsertable(
    ctx: LoadContext,
    target: InsertableTarget
): Promise<void> {
    const { insertableId, elementPath } = target;

    const flags = await readFlagsStep(ctx, insertableId);

    const parameters = await parseConfigurationStep(ctx, target);

    const vendors = parseVendors(target.name, parameters);

    const fastenInfo = flags.supportsFasten
        ? await parseFastenInfoStep(ctx, target)
        : null;

    const { isOpenComposite, hasParts } = await readPartsStep(ctx, target);

    const indexing = decideIndexing(parameters, flags.indexConfigurations);

    const recordsResult = indexing.shouldIndex
        ? await loadConfigurationRecords(
              ctx,
              insertableId,
              elementPath,
              target.elementType,
              parameters,
              indexing.configurations,
              isOpenComposite
          )
        : NO_RECORDS;

    // Onshape renders nothing for an empty studio, so asking would only spend
    // the whole retry budget waiting for a thumbnail that cannot exist.
    const thumbnailUrls = hasParts
        ? await uploadThumbnailsStep(
              ctx,
              `thumbnail-${insertableId}`,
              async () =>
                  uploadThumbnails(
                      ctx.env.BLOB,
                      await getOnshapeApiFromContext(ctx),
                      elementPath,
                      target.microversionId
                  )
          )
        : null;

    const buildIssues = addBuildIssue(
        hasParts
            ? checkInsertable({
                  vendors,
                  thumbnailUrls,
                  records: recordsResult.records
              })
            : [{ type: BuildIssueType.NO_PARTS }],
        ...recordsResult.buildIssues,
        ...indexing.buildIssues
    );

    const parsed: ParsedInsertable = {
        vendors,
        thumbnailUrls,
        fastenInfo,
        isOpenComposite,
        buildIssues,
        configuration: { parameters, records: recordsResult.records }
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), target, parsed)
    );
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
    return ctx.step.do(`config-${insertableId}`, async () => {
        const onshapeConfiguration = await getConfiguration(
            await getOnshapeApiFromContext(ctx),
            elementPath
        );
        return parseOnshapeConfiguration(onshapeConfiguration);
    });
}

/** What one look at a part studio's default parts tells the rest of the load. */
interface PartsSummary {
    isOpenComposite: boolean;
    hasParts: boolean;
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
        return Promise.resolve({ isOpenComposite: false, hasParts: true });
    }
    return ctx.step.do(`open-composite-${insertableId}`, async () => {
        const parts = await getParts(
            await getOnshapeApiFromContext(ctx),
            elementPath,
            {}
        );
        return {
            isOpenComposite: computeOpenComposite(parts),
            hasParts: parts.length > 0
        };
    });
}

function parseFastenInfoStep(
    ctx: LoadContext,
    { insertableId, elementPath, elementType }: InsertableTarget
): Promise<FastenInfo> {
    return ctx.step.do(`fasten-${insertableId}`, async () =>
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
        buildIssues: parsed.buildIssues,
        lastLoadedAt: Date.now()
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

    // Keep the row while it holds either parameters or records; an insertable
    // that is neither configurable nor indexed needs none.
    let configurationWrite;
    if (
        configuration.parameters.length > 0 ||
        configuration.records.length > 0
    ) {
        configurationWrite = db
            .insert(configurations)
            .values({ id: target.insertableId, ...configuration })
            .onConflictDoUpdate({
                target: configurations.id,
                set: configuration
            });
    } else {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, target.insertableId));
    }

    await db.batch([insertableWrite, configurationWrite]);
}
