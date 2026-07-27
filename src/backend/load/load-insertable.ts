import { eq } from "drizzle-orm";
import { type Db, getDb } from "../db";
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
    type InsertableToLoad,
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
    toLoad: InsertableToLoad
): Promise<void> {
    const { insertableId, path } = toLoad;

    const parameters = await parseConfigurationStep(ctx, toLoad);

    const vendors = parseVendors(toLoad.name, parameters);

    const fastenInfo = await parseFastenInfoStep(ctx, toLoad);

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromLoadContext(ctx),
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
        buildIssues: checkInsertable({ vendors, thumbnailUrls })
    };

    // Part numbers are computed separately, in loadGroup's post-pass;
    // saveInsertable clears any stale values here.
    await ctx.step.do(`save-${insertableId}`, () =>
        saveInsertable(getDb(ctx.env.DB), toLoad, reloaded, parameters)
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
            await getOnshapeApiFromLoadContext(ctx),
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
            await getOnshapeApiFromLoadContext(ctx),
            toLoad.path,
            toLoad.elementType
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
    toLoad: InsertableToLoad,
    reloaded: ReloadedFields,
    parameters: ParameterObj[]
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
            .where(eq(configurations.id, toLoad.insertableId));
    } else {
        configurationWrite = db
            .insert(configurations)
            .values({ id: toLoad.insertableId, parameters, partNumbers: {} })
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
