import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
import type { ElementPath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
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
import {
    type GroupFields,
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
    buildIssues: BuildIssue[];
}

/**
 * Loads and persists a single insertable, independent of every other element
 * in its group. Each stage is its own memoized step, and the row (plus its
 * configuration) is written once at the end — so a permanent failure leaves
 * the stored microversionId stale, which queues just this element for the
 * next reload of its group.
 */
export async function loadInsertable(
    ctx: LoadContext,
    group: GroupFields,
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

    const vendors = parseVendors(element.name, parameters ?? []);

    const fastenInfo = await parseFastenInfoStep(ctx, element, path);

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

    const reloaded: ReloadedFields = {
        name: element.name,
        elementType: element.elementType,
        microversionId: element.microversionId,
        versionId: group.versionId,
        vendors,
        thumbnailUrls,
        fastenInfo,
        buildIssues: checkInsertable({ vendors, thumbnailUrls })
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), group, element, reloaded, parameters)
    );
}

/**
 * Fetches and parses the element's configuration in a single memoized step,
 * returning null when the element has no configuration parameters.
 */
function parseConfigurationStep(
    ctx: LoadContext,
    element: InsertableElement,
    path: ElementPath
): Promise<ParameterObj[] | null> {
    return ctx.step.do(`config-${element.insertableId}`, async () => {
        const rawConfig = await getConfiguration(
            await getOnshapeApiFromLoadContext(ctx),
            path
        );
        return rawConfig.configurationParameters.length === 0
            ? null
            : parseOnshapeConfiguration(rawConfig).parameters;
    });
}

/**
 * Fetches and parses the element's fasten info in a single memoized step, or
 * null for an element that doesn't support fastening.
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
 * The element's single atomic write: an insertable upsert (create and replay
 * converge on one statement; the conflict set is exactly {@link ReloadedFields})
 * plus the configuration row's upsert or delete.
 */
export async function saveInsertable(
    db: Db,
    groupFields: GroupFields,
    element: InsertableElement,
    reloaded: ReloadedFields,
    parameters: ParameterObj[] | null
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
            ...reloaded
        })
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: reloaded
        });

    let configurationWrite;
    if (parameters === null) {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, element.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: element.insertableId, parameters })
            .onConflictDoUpdate({
                target: configurations.id,
                set: { parameters }
            });
    }

    await db.batch([insertableWrite, configurationWrite]);
}
