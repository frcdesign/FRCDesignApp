import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type { ElementPath } from "../../shared/onshape-path";
import type {
    ParameterObj,
    PartNumberMap
} from "../../shared/configuration-models";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../../shared/build-checker";
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
import {
    type ComputedPartNumbers,
    computePartNumbers
} from "./load-part-numbers";
import {
    type InsertableGroupFields,
    type InsertableElement,
    type LoadContext,
    getOnshapeApiFromLoadContext,
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
    // Part number of the default configuration; null unless part-number search
    // is on and the insertable is non-configurable (see load-part-numbers).
    defaultPartNumber: string | null;
    buildIssues: BuildIssue[];
}

/**
 * Loads and persists a single insertable to the database.
 */
export async function loadInsertable(
    ctx: LoadContext,
    group: InsertableGroupFields,
    element: InsertableElement
): Promise<void> {
    const { insertableId } = element;
    const path: ElementPath = {
        documentId: group.documentId,
        instanceId: group.versionId,
        instanceType: "v",
        elementId: element.elementId
    };

    const parameters = await parseConfigurationStep(ctx, element, path);

    const vendors = parseVendors(element.name, parameters);

    const fastenInfo = await parseFastenInfoStep(ctx, element, path);

    const partNumbers = await parsePartNumbersStep(
        ctx,
        element,
        path,
        parameters
    );

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromLoadContext(ctx),
                path,
                element.microversionId
            )
    );

    let buildIssues = checkInsertable({ vendors, thumbnailUrls });
    if (partNumbers.capped) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.TOO_MANY_CONFIGURATIONS
        });
    }

    const reloaded: ReloadedFields = {
        name: element.name,
        elementType: element.elementType,
        microversionId: element.microversionId,
        versionId: group.versionId,
        vendors,
        thumbnailUrls,
        fastenInfo,
        defaultPartNumber: partNumbers.defaultPartNumber,
        buildIssues
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(
            getDb(ctx.env.DB),
            group,
            element,
            reloaded,
            parameters,
            partNumbers.partNumbers
        )
    );
}

/**
 * Fetches and parses the element's configuration.
 */
function parseConfigurationStep(
    ctx: LoadContext,
    element: InsertableElement,
    path: ElementPath
): Promise<ParameterObj[]> {
    return ctx.step.do(`config-${element.insertableId}`, async () => {
        const onshapeConfiguration = await getConfiguration(
            await getOnshapeApiFromLoadContext(ctx),
            path
        );
        return parseOnshapeConfiguration(onshapeConfiguration);
    });
}

/**
 * Computes the insertable's part-number data when part-number search is enabled.
 * A no-op (empty result) otherwise.
 */
function parsePartNumbersStep(
    ctx: LoadContext,
    element: InsertableElement,
    path: ElementPath,
    parameters: ParameterObj[]
): Promise<ComputedPartNumbers> {
    if (!element.searchPartNumbers) {
        return Promise.resolve({
            defaultPartNumber: null,
            partNumbers: {},
            capped: false
        });
    }
    return ctx.step.do(`part-numbers-${element.insertableId}`, async () =>
        computePartNumbers(
            await getOnshapeApiFromLoadContext(ctx),
            path,
            element.elementType,
            parameters
        )
    );
}

/**
 * Fetches and parses the element's fasten info.
 */
async function parseFastenInfoStep(
    ctx: LoadContext,
    element: InsertableElement,
    path: ElementPath
): Promise<FastenInfo | null> {
    if (!element.supportsFasten) {
        return null;
    }
    return ctx.step.do(`fasten-${element.insertableId}`, async () =>
        parseFastenInfo(
            await getOnshapeApiFromLoadContext(ctx),
            path,
            element.elementType
        )
    );
}

/**
 * Writes a single insertable (plus configuration) to the database.
 */
export async function saveInsertable(
    db: Db,
    groupFields: InsertableGroupFields,
    element: InsertableElement,
    reloaded: ReloadedFields,
    parameters: ParameterObj[],
    partNumbers: PartNumberMap
): Promise<void> {
    const insertableWrite = db
        .insert(insertables)
        .values({
            id: element.insertableId,
            libraryId: groupFields.libraryId,
            groupId: groupFields.groupId,
            documentId: groupFields.documentId,
            elementId: element.elementId,
            sortOrder: element.sortOrder,
            supportsFasten: element.supportsFasten,
            searchPartNumbers: element.searchPartNumbers,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: reloaded
        });

    let configurationWrite;
    if (parameters.length === 0) {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, element.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: element.insertableId, parameters, partNumbers })
            .onConflictDoUpdate({
                target: configurations.id,
                set: { parameters, partNumbers }
            });
    }

    await db.batch([insertableWrite, configurationWrite]);
}
