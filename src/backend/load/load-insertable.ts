import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type {
    Configuration,
    ConfigurationParameter
} from "../../shared/configuration-models";
import { addBuildIssue, type BuildIssue } from "../../shared/build-checker";
import type { FastenInfo, ThumbnailUrls, Vendor } from "../../shared/types";
import { configurations, insertables } from "../../shared/schema";
import { uploadThumbnails } from "../routes/thumbnails";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { checkInsertable } from "../parse/build-checks";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { parseFastenInfo } from "../parse/insert-and-fasten";
import { NO_PART_NUMBERS, loadPartNumbers } from "../parse/parse-part-number";
import {
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./load-context";
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
    /** Part number of the default configuration; null when not indexed. */
    defaultPartNumber: string | null;
    buildIssues: BuildIssue[];
    configuration: Configuration;
}

/** The user-owned flags that decide how much of a load runs. */
interface InsertableFlags {
    supportsFasten: boolean;
    searchPartNumbers: boolean;
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

    const partNumberResult = flags.searchPartNumbers
        ? await loadPartNumbers(
              ctx,
              insertableId,
              elementPath,
              target.elementType,
              parameters
          )
        : NO_PART_NUMBERS;

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

    const parsed: ParsedInsertable = {
        vendors,
        thumbnailUrls,
        fastenInfo,
        defaultPartNumber: partNumberResult.defaultPartNumber,
        buildIssues: addBuildIssue(
            checkInsertable({ vendors, thumbnailUrls }),
            ...partNumberResult.buildIssues
        ),
        configuration: {
            parameters,
            partNumbers: partNumberResult.partNumbers
        }
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
                searchPartNumbers: insertables.searchPartNumbers
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        return row ?? { supportsFasten: false, searchPartNumbers: false };
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
        defaultPartNumber: parsed.defaultPartNumber,
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
            searchPartNumbers: false,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: insertables.id,
            set: reloaded
        });

    let configurationWrite;
    if (configuration.parameters.length === 0) {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, target.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: target.insertableId, ...configuration })
            .onConflictDoUpdate({
                target: configurations.id,
                set: configuration
            });
    }

    await db.batch([insertableWrite, configurationWrite]);
}
