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
    BuildIssueType,
    clearBuildIssue
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

    // Part numbers are computed separately, in loadGroup's rate-limit-aware
    // post-pass; saveInsertable clears any stale values here.
    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), group, element, reloaded, parameters)
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
 * Writes a single insertable (plus configuration) to the database. Part-number
 * fields are cleared here; loadGroup's post-pass repopulates them via
 * {@link writePartNumbers} for insertables with part-number search enabled.
 */
export async function saveInsertable(
    db: Db,
    groupFields: InsertableGroupFields,
    element: InsertableElement,
    reloaded: ReloadedFields,
    parameters: ParameterObj[]
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
            defaultPartNumber: null,
            ...reloaded
        })
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: { ...reloaded, defaultPartNumber: null }
        });

    let configurationWrite;
    if (parameters.length === 0) {
        configurationWrite = db
            .delete(configurations)
            .where(eq(configurations.id, element.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: element.insertableId, parameters, partNumbers: {} })
            .onConflictDoUpdate({
                target: configurations.id,
                set: { parameters, partNumbers: {} }
            });
    }

    await db.batch([insertableWrite, configurationWrite]);
}

/** The part-number data written by loadGroup's post-pass for one insertable. */
export interface PartNumberWrite {
    defaultPartNumber: string | null;
    partNumbers: PartNumberMap;
    /** Enumeration exceeded the cap; flags TOO_MANY_CONFIGURATIONS. */
    capped: boolean;
    /** Fetching couldn't finish (rate-limited); flags PART_NUMBER_INDEX_INCOMPLETE. */
    incomplete: boolean;
}

/**
 * Persists computed part numbers onto an already-saved insertable: its
 * `defaultPartNumber`, its configuration row's `partNumbers` map, and the
 * part-number build issues (merged into the insertable's existing issues).
 */
export async function writePartNumbers(
    db: Db,
    insertableId: string,
    write: PartNumberWrite
): Promise<void> {
    const row = await db
        .select({ buildIssues: insertables.buildIssues })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();

    let buildIssues = clearBuildIssue(
        clearBuildIssue(
            row?.buildIssues ?? [],
            BuildIssueType.TOO_MANY_CONFIGURATIONS
        ),
        BuildIssueType.PART_NUMBER_INDEX_INCOMPLETE
    );
    if (write.capped) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.TOO_MANY_CONFIGURATIONS
        });
    } else if (write.incomplete) {
        buildIssues = addBuildIssue(buildIssues, {
            type: BuildIssueType.PART_NUMBER_INDEX_INCOMPLETE
        });
    }

    await db.batch([
        db
            .update(insertables)
            .set({ defaultPartNumber: write.defaultPartNumber, buildIssues })
            .where(eq(insertables.id, insertableId)),
        // No-op when the insertable has no configuration row.
        db
            .update(configurations)
            .set({ partNumbers: write.partNumbers })
            .where(eq(configurations.id, insertableId))
    ]);
}
