import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Db, getDb } from "../db";
import { ElementType } from "../../shared/types";
import type { ThumbnailUrls } from "../../shared/types";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../../shared/build-issues";
import { group, insertables } from "../../shared/schema";
import { uploadDocumentThumbnails } from "../routes/thumbnails";
import { getContents } from "../onshape-api/endpoints/documents";
import type { OnshapeElement } from "../onshape-api/onshape-types";
import { checkGroup } from "../parse/build-checks";
import { parseInsertableTabs } from "../parse/parse-document-contents";
import { loadInsertable } from "./load-insertable";
import {
    type GroupTarget,
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./load-common";
import { uploadThumbnailsStep } from "./load-steps";
import type { InstancePath } from "../../shared/onshape-path";

export interface GroupLoadResult {
    loadedElements: number;
    deletedElements: number;
    failedElements: number;
}

/** What a load computes for the group row. */
interface ParsedGroup {
    name: string;
    smallThumbnailUrl: string | null;
    largeThumbnailUrl: string | null;
    buildIssues: BuildIssue[];
    /** When this (successful) load completed, epoch ms. */
    lastLoadedAt: number;
    /** Undefined if an insertable failed. */
    versionId?: string;
}

export async function loadGroup(
    ctx: LoadContext,
    target: GroupTarget,
    forceReload: boolean
): Promise<GroupLoadResult> {
    const { groupId, versionPath } = target;

    // Read the document's loadable tabs (display order) and the stored rows.
    const insertableTabs = await ctx.step.do(`insertable-tabs-${groupId}`, () =>
        fetchInsertableTabs(ctx, versionPath)
    );
    const storedInsertables = await ctx.step.do(
        `stored-insertables-${groupId}`,
        () => fetchStoredInsertables(ctx, groupId)
    );

    // Wrap in a step so new UUIDs are deterministic
    const insertablesToLoad = await ctx.step.do(
        `select-insertables-${groupId}`,
        () =>
            Promise.resolve(
                selectInsertablesToLoad(
                    target,
                    insertableTabs,
                    storedInsertables,
                    forceReload
                )
            )
    );
    // Removal detection is pure, so it needs no step.
    const removedInsertableIds = findRemovedInsertables(
        insertableTabs,
        storedInsertables
    );

    const failedInsertableIds = await loadInsertables(ctx, insertablesToLoad);

    const thumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromContext(ctx),
                versionPath
            )
    );

    await ctx.step.do(`save-group-${groupId}`, () =>
        saveGroup(getDb(ctx.env.DB), target, {
            thumbnailUrls,
            removedInsertableIds,
            failedInsertableIds
        })
    );

    return {
        loadedElements: insertablesToLoad.length - failedInsertableIds.length,
        deletedElements: removedInsertableIds.length,
        failedElements: failedInsertableIds.length
    };
}

/**
 * Loads every selected insertable in parallel, returning the ids of the ones
 * that failed.
 */
async function loadInsertables(
    ctx: LoadContext,
    targets: InsertableTarget[]
): Promise<string[]> {
    const failedInsertableIds: string[] = [];
    await Promise.all(
        targets.map((target) =>
            ctx.limit(async () => {
                try {
                    await loadInsertable(ctx, target);
                } catch {
                    failedInsertableIds.push(target.insertableId);
                }
            })
        )
    );
    return failedInsertableIds;
}

interface SaveGroupInput {
    thumbnailUrls: ThumbnailUrls | null;
    /** Stored insertables whose tab left the document. */
    removedInsertableIds: string[];
    /** Insertables that threw while loading. */
    failedInsertableIds: string[];
}

/**
 * Writes the group row, drops the insertables whose tabs are gone, and flags the
 * ones that failed to load.
 */
async function saveGroup(
    db: Db,
    target: GroupTarget,
    input: SaveGroupInput
): Promise<void> {
    const { thumbnailUrls, removedInsertableIds } = input;
    const hasFailedInsertables = input.failedInsertableIds.length > 0;

    const buildIssues = checkGroup({
        hasThumbnailTab: !!target.thumbnailElementId,
        thumbnailUrls,
        hasFailedInsertables
    });
    const parsed: ParsedGroup = {
        name: target.name,
        smallThumbnailUrl: thumbnailUrls?.small ?? null,
        largeThumbnailUrl: thumbnailUrls?.large ?? null,
        buildIssues,
        // Stamp the successful load; failures never reach here, so a failed
        // reload leaves the group's last-good time untouched.
        lastLoadedAt: Date.now()
    };
    if (!hasFailedInsertables) {
        parsed.versionId = target.versionPath.instanceId;
    }

    const writes: BatchItem<"sqlite">[] = [
        db.update(group).set(parsed).where(eq(group.id, target.groupId))
    ];
    if (!hasFailedInsertables) {
        // A tab whose microversion didn't change is skipped, so it never went
        // through saveInsertable and still points at the previous version.
        // Its geometry is identical, but the stale id is what insertion and
        // every document link are built from, so move the whole group forward
        // together with the group row.
        writes.push(
            db
                .update(insertables)
                .set({ versionId: target.versionPath.instanceId })
                .where(eq(insertables.groupId, target.groupId))
        );
    }
    if (removedInsertableIds.length > 0) {
        // Configurations and favorites follow deleted insertables via their
        // cascading foreign keys.
        writes.push(
            db
                .delete(insertables)
                .where(inArray(insertables.id, removedInsertableIds))
        );
    }
    writes.push(
        ...(await flagFailedInsertables(db, input.failedInsertableIds))
    );

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/**
 * Adds `LOAD_FAILED` to each failed insertable's stored issues, keeping the ones
 * its last good load recorded. A brand-new insertable has no row yet, so it gets
 * no write — the group's `INSERTABLES_FAILED` covers it.
 */
async function flagFailedInsertables(
    db: Db,
    failedInsertableIds: string[]
): Promise<BatchItem<"sqlite">[]> {
    if (failedInsertableIds.length === 0) {
        return [];
    }
    const rows = await db
        .select({ id: insertables.id, buildIssues: insertables.buildIssues })
        .from(insertables)
        .where(inArray(insertables.id, failedInsertableIds));

    return rows.map((row) =>
        db
            .update(insertables)
            .set({
                buildIssues: addBuildIssue(row.buildIssues, {
                    type: BuildIssueType.LOAD_FAILED
                })
            })
            .where(eq(insertables.id, row.id))
    );
}

/**
 * Fetches the document's part studio / assembly tabs, in display order.
 */
async function fetchInsertableTabs(
    ctx: LoadContext,
    versionPath: InstancePath
): Promise<OnshapeElement[]> {
    const contents = await getContents(
        await getOnshapeApiFromContext(ctx),
        versionPath
    );
    return parseInsertableTabs(contents);
}

/**
 * What an existing insertable row contributes to the reload decision: its id, so
 * a reload keeps it, and its microversion, to tell whether it changed.
 */
export interface StoredInsertable {
    id: string;
    elementId: string;
    microversionId: string;
}

/**
 * Fetches the group's stored insertables.
 */
async function fetchStoredInsertables(
    ctx: LoadContext,
    groupId: string
): Promise<StoredInsertable[]> {
    return getDb(ctx.env.DB)
        .select({
            id: insertables.id,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId));
}

/**
 * Selects the tabs to reload: new ones, and stored ones whose microversion
 * changed (or all of them, on `forceReload`). A stored insertable keeps its id;
 * a new one gets a fresh one.
 */
export function selectInsertablesToLoad(
    target: GroupTarget,
    insertableTabs: OnshapeElement[],
    stored: StoredInsertable[],
    forceReload: boolean
): InsertableTarget[] {
    const storedByElementId = new Map(
        stored.map((row) => [row.elementId, row])
    );

    const insertableTargets: InsertableTarget[] = [];
    insertableTabs.forEach((tab, sortOrder) => {
        const storedRow = storedByElementId.get(tab.id);
        if (
            storedRow &&
            !forceReload &&
            storedRow.microversionId === tab.microversionId
        ) {
            return;
        }

        insertableTargets.push({
            insertableId: storedRow?.id ?? crypto.randomUUID(),
            libraryId: target.libraryId,
            groupId: target.groupId,
            elementPath: { ...target.versionPath, elementId: tab.id },
            // OnshapeElementType and the app ElementType share these values.
            elementType: tab.elementType as unknown as ElementType,
            name: tab.name,
            microversionId: tab.microversionId,
            sortOrder
        });
    });
    return insertableTargets;
}

/**
 * Finds the stored insertables whose tab no longer exists in the document;
 * their ids are the rows to delete.
 */
export function findRemovedInsertables(
    insertableTabs: OnshapeElement[],
    storedInsertables: StoredInsertable[]
): string[] {
    const tabIds = new Set(insertableTabs.map((tab) => tab.id));
    return storedInsertables
        .filter((row) => !tabIds.has(row.elementId))
        .map((row) => row.id);
}
