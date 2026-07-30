import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type {
    Configuration,
    ConfigurationParameter
} from "../../shared/configuration-models";
import { addBuildIssue, type BuildIssue } from "../../shared/build-checker";
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
import { loadPartNumbers, NO_PART_NUMBERS } from "./load-part-numbers";
import {
    type InsertableToLoad,
    type LoadContext,
    type ParseData,
    getOnshapeApiFromContext,
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
    insertableToLoad: InsertableToLoad
): Promise<void> {
    const { insertableId, path } = insertableToLoad;

    const parseData: ParseData = {
        insertableId,
        insertablePath: path,
        elementType: insertableToLoad.elementType
    };

    let buildIssues: BuildIssue[] = [];

    const parameters = await parseConfigurationStep(ctx, parseData);

    const vendors = parseVendors(insertableToLoad.name, parameters);

    const fastenInfo = insertableToLoad.supportsFasten
        ? await parseFastenInfoStep(ctx, parseData)
        : null;

    const partNumberResult = insertableToLoad.searchPartNumbers
        ? await loadPartNumbers(ctx, parseData, parameters)
        : NO_PART_NUMBERS;
    buildIssues = addBuildIssue(buildIssues, ...partNumberResult.buildIssues);

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromContext(ctx),
                path,
                insertableToLoad.microversionId
            )
    );
    buildIssues = addBuildIssue(
        buildIssues,
        ...checkInsertable({ vendors, thumbnailUrls })
    );

    const reloaded: ReloadedFields = {
        name: insertableToLoad.name,
        elementType: insertableToLoad.elementType,
        microversionId: insertableToLoad.microversionId,
        versionId: path.instanceId,
        vendors,
        thumbnailUrls,
        fastenInfo,
        defaultPartNumber: partNumberResult.defaultPartNumber,
        buildIssues
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), insertableToLoad, reloaded, {
            parameters,
            partNumbers: partNumberResult.partNumbers
        })
    );
}

/**
 * Fetches and parses the element's configuration.
 */
function parseConfigurationStep(
    ctx: LoadContext,
    { insertableId, insertablePath }: ParseData
): Promise<ConfigurationParameter[]> {
    return ctx.step.do(`config-${insertableId}`, async () => {
        const onshapeConfiguration = await getConfiguration(
            await getOnshapeApiFromContext(ctx),
            insertablePath
        );
        return parseOnshapeConfiguration(onshapeConfiguration);
    });
}

/**
 * Fetches and parses the element's fasten info.
 */
function parseFastenInfoStep(
    ctx: LoadContext,
    { insertableId, insertablePath, elementType }: ParseData
): Promise<FastenInfo> {
    return ctx.step.do(`fasten-${insertableId}`, async () =>
        parseFastenInfo(
            await getOnshapeApiFromContext(ctx),
            insertablePath,
            elementType
        )
    );
}

/**
 * Writes a single insertable (plus configuration) to the database.
 */
export async function saveInsertable(
    db: Db,
    toLoad: InsertableToLoad,
    reloaded: ReloadedFields,
    configuration: Configuration
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
            isVisible: toLoad.isVisible,
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
