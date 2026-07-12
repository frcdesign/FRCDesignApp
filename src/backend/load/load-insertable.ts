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
    type GroupContext,
    type GroupFields,
    type InsertableElement,
    api,
    uploadThumbnailsStep
} from "./load-utils";

/**
 * Fields mirrored from Onshape hence updated on reload.
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
    ctx: GroupContext,
    element: InsertableElement
): Promise<void> {
    const { insertableId } = element;
    const path: ElementPath = {
        documentId: ctx.documentId,
        instanceId: ctx.versionId,
        instanceType: "v",
        elementId: element.elementId
    };

    const parameters = await ctx.step.do(`config-${insertableId}`, async () => {
        const rawConfig = await getConfiguration(await api(ctx), path);
        return rawConfig.configurationParameters.length === 0
            ? null
            : parseOnshapeConfiguration(rawConfig).parameters;
    });

    const vendors = parseVendors(element.name, parameters ?? []);

    const fastenInfo = element.supportsFasten
        ? await ctx.step.do(`fasten-${insertableId}`, async () =>
              parseFastenInfo(await api(ctx), path, element.elementType)
          )
        : null;

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await api(ctx),
                path,
                element.microversionId
            )
    );

    const reloaded: ReloadedFields = {
        name: element.name,
        elementType: element.elementType,
        microversionId: element.microversionId,
        versionId: ctx.versionId,
        vendors,
        thumbnailUrls,
        fastenInfo,
        buildIssues: checkInsertable({ vendors, thumbnailUrls })
    };

    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), ctx, element, reloaded, parameters)
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
            // New-row seeds for the user-owned columns. The conflict set below
            // omits them, so on an existing row the user's values survive;
            // isVisible and isOpenComposite ride the schema defaults.
            sortOrder: element.sortOrder,
            supportsFasten: element.supportsFasten,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: reloaded
        });

    const configurationWrite =
        parameters !== null
            ? db
                  .insert(configurations)
                  .values({ id: element.insertableId, parameters })
                  .onConflictDoUpdate({
                      target: configurations.id,
                      set: { parameters }
                  })
            : // The element has no configuration — drop any stale row.
              db
                  .delete(configurations)
                  .where(eq(configurations.id, element.insertableId));

    await db.batch([insertableWrite, configurationWrite]);
}
