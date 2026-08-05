import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type {
    Configuration,
    ConfigurationParameter
} from "../../shared/configuration-models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../../shared/build-issues";
import {
    ElementType,
    type FastenInfo,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import { configurations, insertables } from "../../shared/schema";
import { uploadThumbnails } from "../routes/thumbnails";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { getParts } from "../onshape-api/endpoints/parts";
import { checkInsertable } from "../parse/build-checks";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { parseFastenInfo } from "../parse/insert-and-fasten";
import {
    NO_RECORDS,
    computeOpenComposite,
    decideIndexing,
    loadConfigurationRecords
} from "../parse/parse-configuration-records";
import {
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./load-common";
import { uploadThumbnailsStep } from "./load-steps";

/**
 * Everything a load computes for an insertable by reading Onshape. Exactly the
 * set of columns a reload overwrites — the rest of the row is either identity or
 * owned by the user.
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
    forceIndex: boolean;
}

/**
 * Loads and persists a single insertable to the database.
 */
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

    const isOpenComposite = await computeOpenCompositeStep(ctx, target);

    const { shouldIndex, manyConfigurations } = decideIndexing(
        vendors,
        parameters,
        flags.forceIndex
    );

    const recordsResult = shouldIndex
        ? await loadConfigurationRecords(
              ctx,
              insertableId,
              elementPath,
              target.elementType,
              parameters,
              isOpenComposite
          )
        : NO_RECORDS;

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromContext(ctx),
                elementPath,
                target.microversionId
            )
    );

    let buildIssues = addBuildIssue(
        checkInsertable({ vendors, thumbnailUrls }),
        ...recordsResult.buildIssues
    );
    if (manyConfigurations) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.MANY_CONFIGURATIONS
        });
    }

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
                forceIndex: insertables.forceIndex
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        return row ?? { supportsFasten: false, forceIndex: false };
    });
}

/**
 * Fetches and parses the element's configuration.
 */
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

/**
 * Determines whether a part studio is an open composite from its default
 * configuration. Runs on every load, not just under indexing, so the insert
 * path always requests the right part types. Assemblies are never composites,
 * so they skip the fetch.
 */
function computeOpenCompositeStep(
    ctx: LoadContext,
    { insertableId, elementPath, elementType }: InsertableTarget
): Promise<boolean> {
    if (elementType !== ElementType.PART_STUDIO) {
        return Promise.resolve(false);
    }
    return ctx.step.do(`open-composite-${insertableId}`, async () =>
        computeOpenComposite(
            await getParts(await getOnshapeApiFromContext(ctx), elementPath, {})
        )
    );
}

/**
 * Fetches and parses the element's fasten info.
 */
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
 * Writes a single insertable (plus its configuration) to the database.
 *
 * The reloaded columns come from `parsed` plus the tab facts on `target`;
 * everything else is written only on insert, so a reload preserves the row's
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
        thumbnailUrls: parsed.thumbnailUrls,
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
            forceIndex: false,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: insertables.id,
            set: reloaded
        });

    // Keep a configurations row whenever there's config data to store — the
    // parameters a configurable insertable exposes, the records an indexed one
    // produced, or both. A non-configurable, non-indexed insertable needs neither.
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
