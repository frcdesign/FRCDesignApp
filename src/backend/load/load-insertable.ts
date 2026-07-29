import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type {
    InsertableConfiguration,
    ParameterObj
} from "../../shared/configuration-models";
import type { BuildIssue } from "../../shared/build-checker";
import type {
    ElementType,
    FastenInfo,
    ThumbnailUrls,
    Vendor
} from "../../shared/types";
import { configurations, insertables } from "../../shared/schema";
import { uploadThumbnails } from "../routes/thumbnails";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { checkInsertable } from "../parse/build-checks";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { parseFastenInfo } from "../parse/insert-and-fasten";
import { loadPartNumbers, withPartNumberIssues } from "./load-part-numbers";
import {
    type InsertableToLoad,
    type LoadContext,
    getOnshapeApi,
    uploadThumbnailsStep
} from "./load-utils";

/**
 * Fields which are recomputed as a part of loading an insertable.
 */
export interface ReloadedFields {
    name: string;
    elementType: ElementType;
    microversionId: string;
    versionId: string;
    vendors: Vendor[];
    thumbnailUrls: ThumbnailUrls | null;
    fastenInfo: FastenInfo | null;
    /** Set only for non-configurable insertables; see load-part-numbers. */
    defaultPartNumber: string | null;
    buildIssues: BuildIssue[];
}

/**
 * Loads and persists a single insertable to the database.
 */
export async function loadInsertable(
    ctx: LoadContext,
    toLoad: InsertableToLoad
): Promise<void> {
    const { insertableId, path } = toLoad;

    const parameters = await parseConfigurationStep(ctx, toLoad);

    const vendors = parseVendors(toLoad.name, parameters);

    const fastenInfo = await parseFastenInfoStep(ctx, toLoad);

    const partNumbers = await loadPartNumbers(ctx, toLoad, parameters);

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApi(ctx),
                path,
                toLoad.microversionId
            )
    );

    const reloaded: ReloadedFields = {
        name: toLoad.name,
        elementType: toLoad.elementType,
        microversionId: toLoad.microversionId,
        versionId: path.instanceId,
        vendors,
        thumbnailUrls,
        fastenInfo,
        defaultPartNumber: partNumbers.defaultPartNumber,
        buildIssues: withPartNumberIssues(
            checkInsertable({ vendors, thumbnailUrls }),
            partNumbers
        )
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), toLoad, reloaded, {
            parameters,
            partNumbers: partNumbers.partNumbers
        })
    );
}

/**
 * Fetches and parses the element's configuration.
 */
function parseConfigurationStep(
    ctx: LoadContext,
    toLoad: InsertableToLoad
): Promise<ParameterObj[]> {
    return ctx.step.do(`config-${toLoad.insertableId}`, async () => {
        const onshapeConfiguration = await getConfiguration(
            await getOnshapeApi(ctx),
            toLoad.path
        );
        return parseOnshapeConfiguration(onshapeConfiguration);
    });
}

/**
 * Fetches and parses the element's fasten info.
 */
async function parseFastenInfoStep(
    ctx: LoadContext,
    toLoad: InsertableToLoad
): Promise<FastenInfo | null> {
    if (!toLoad.supportsFasten) {
        return null;
    }
    return ctx.step.do(`fasten-${toLoad.insertableId}`, async () =>
        parseFastenInfo(
            await getOnshapeApi(ctx),
            toLoad.path,
            toLoad.elementType
        )
    );
}

/**
 * Writes a single insertable (plus configuration) to the database, including
 * the part numbers computed for this load. When part-number search is off both
 * are empty, which keeps the columns clear — `getPartNumberMap` in
 * library-data.ts relies on that rather than re-checking the flag.
 */
export async function saveInsertable(
    db: Db,
    toLoad: InsertableToLoad,
    reloaded: ReloadedFields,
    configuration: InsertableConfiguration
): Promise<void> {
    const insertableWrite = db
        .insert(insertables)
        .values({
            id: toLoad.insertableId,
            libraryId: toLoad.libraryId,
            groupId: toLoad.groupId,
            documentId: toLoad.path.documentId,
            elementId: toLoad.path.elementId,
            sortOrder: toLoad.sortOrder,
            supportsFasten: toLoad.supportsFasten,
            searchPartNumbers: toLoad.searchPartNumbers,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: reloaded
        });

    let configurationWrite;
    if (configuration.parameters.length === 0) {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, toLoad.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: toLoad.insertableId, ...configuration })
            .onConflictDoUpdate({
                target: configurations.id,
                set: configuration
            });
    }

    await db.batch([insertableWrite, configurationWrite]);
}
