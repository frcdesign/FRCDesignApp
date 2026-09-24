import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Db, getDb } from "../../db/client";
import { chunkForInArray } from "../../db/chunk";
import { ElementType } from "../../lib/onshape/element-type";
import type { ThumbnailUrls } from "../thumbnails/contract";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    hasBuildIssue
} from "../build-checker/issues";
import { groups, insertables } from "../../db/schema";
import { uploadThumbnails } from "../thumbnails/store";
import { getContents } from "../../lib/onshape/endpoints/documents";
import type {
    OnshapeDocumentContents,
    OnshapeElement
} from "../../lib/onshape/types";
import { checkGroup } from "../build-checker/checks";
import { parseInsertableTabs } from "./parse-document-contents";
import { loadInsertable } from "./load-insertable";
import {
    type GroupTarget,
    type InsertableTarget,
    type LoadContext,
    type LoadingGroup,
    getOnshapeApiFromContext
} from "./context";
import {
    deleteStaleThumbnailWorkspaces,
    ensureThumbnailWorkspace
} from "../thumbnails/workspace";
import { ONSHAPE_STEP_RETRIES, uploadThumbnailsStep } from "./steps";

interface GroupLoadResult {
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
    lastLoadedAt: Date;
    /** Undefined if an insertable failed. */
    versionId?: string;
    /** Moves with `versionId`, so the row's date is always that version's. */
    versionCreatedAt?: Date;
    /** Moves with `versionId`: it is that version's branch. */
    thumbnailWorkspaceId?: string;
}

export async function loadGroup(
    ctx: LoadContext,
    group: GroupTarget,
    forceReload: boolean
): Promise<GroupLoadResult> {
    const { groupId, versionPath } = group;

    // Here rather than when resolving, so a skipped group branches nothing.
    const thumbnailPath = await ctx.step.do(
        `thumbnail-workspace-${groupId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            ensureThumbnailWorkspace(
                await getOnshapeApiFromContext(ctx),
                versionPath
            )
    );
    const target: LoadingGroup = { ...group, thumbnailPath };

    const contents = await ctx.step.do(
        `document-contents-${groupId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            getContents(await getOnshapeApiFromContext(ctx), versionPath)
    );
    const insertableTabs = parseInsertableTabs(contents);
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
    // Removal and reorder detection are both pure, so neither needs a step.
    const removedInsertableIds = findRemovedInsertables(
        insertableTabs,
        storedInsertables
    );
    const movedInsertables = findMovedInsertables(
        insertableTabs,
        storedInsertables
    );

    const failedInsertableIds = await loadInsertables(ctx, insertablesToLoad);

    const thumbnailUrls = await loadDocumentThumbnail(ctx, target, contents);

    await ctx.step.do(`save-group-${groupId}`, () =>
        saveGroup(getDb(ctx.env.DB), target, {
            thumbnailUrls,
            removedInsertableIds,
            movedInsertables,
            failedInsertableIds
        })
    );

    // A leftover branch is clutter, not breakage, so this is never fatal.
    if (failedInsertableIds.length === 0) {
        await ctx.step
            .do(`delete-stale-workspaces-${groupId}`, async () =>
                deleteStaleThumbnailWorkspaces(
                    await getOnshapeApiFromContext(ctx),
                    versionPath,
                    thumbnailPath.instanceId
                )
            )
            .catch((error: unknown) => {
                console.error(
                    `Failed to delete stale thumbnail workspaces of ${groupId}`,
                    error
                );
            });
    }

    return {
        loadedElements: insertablesToLoad.length - failedInsertableIds.length,
        deletedElements: removedInsertableIds.length,
        failedElements: failedInsertableIds.length
    };
}

/**
 * Returns the ids that failed. `loadInsertable` takes a limiter slot for its
 * Onshape calls, which bounds the parallelism.
 */
async function loadInsertables(
    ctx: LoadContext,
    targets: InsertableTarget[]
): Promise<string[]> {
    const failedInsertableIds: string[] = [];
    await Promise.all(
        targets.map(async (target) => {
            try {
                await loadInsertable(ctx, target);
            } catch (error) {
                // The row records only that it failed, so this is the only record of why.
                console.error(
                    `Failed to load insertable ${target.insertableId} (${target.name})`,
                    error
                );
                failedInsertableIds.push(target.insertableId);
            }
        })
    );
    return failedInsertableIds;
}

async function loadDocumentThumbnail(
    ctx: LoadContext,
    target: LoadingGroup,
    contents: OnshapeDocumentContents
): Promise<ThumbnailUrls | null> {
    const { groupId, thumbnailPath } = target;

    // Not fatal: `checkGroup` flags a missing thumbnail, and failing here would
    // lose the group's insertables.
    const element = documentThumbnailElement(target, contents);
    if (!element) {
        return null;
    }

    return uploadThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        async () =>
            uploadThumbnails(
                ctx.env.BLOB,
                await getOnshapeApiFromContext(ctx),
                { ...thumbnailPath, elementId: element.id },
                element.microversionId
            )
    );
}

/** The element the document designates, or its first. */
function documentThumbnailElement(
    target: GroupTarget,
    contents: OnshapeDocumentContents
): OnshapeElement | undefined {
    const designated = target.thumbnailElementId;
    return designated
        ? contents.elements.find((element) => element.id === designated)
        : contents.elements[0];
}

interface SaveGroupInput {
    thumbnailUrls: ThumbnailUrls | null;
    /** Stored insertables whose tab left the document. */
    removedInsertableIds: string[];
    /** Stored insertables the document's tab order moved, and where to. */
    movedInsertables: InsertableOrder[];
    /** Insertables that threw while loading. */
    failedInsertableIds: string[];
}

async function saveGroup(
    db: Db,
    target: LoadingGroup,
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
        // Failed loads never get here, so they keep the last good time.
        lastLoadedAt: new Date()
    };
    if (!hasFailedInsertables) {
        parsed.versionId = target.versionPath.instanceId;
        parsed.versionCreatedAt = target.versionCreatedAt;
        parsed.thumbnailWorkspaceId = target.thumbnailPath.instanceId;
    }

    const writes: BatchItem<"sqlite">[] = [
        db.update(groups).set(parsed).where(eq(groups.id, target.groupId))
    ];
    if (!hasFailedInsertables) {
        // Skipped tabs are never saved, so move the whole group to the new version.
        writes.push(
            db
                .update(insertables)
                .set({
                    versionId: target.versionPath.instanceId,
                    versionCreatedAt: target.versionCreatedAt
                })
                .where(eq(insertables.groupId, target.groupId))
        );
    }
    for (const { insertableId, sortOrder } of input.movedInsertables) {
        writes.push(
            db
                .update(insertables)
                .set({ sortOrder })
                .where(eq(insertables.id, insertableId))
        );
    }
    // Configurations and favorites cascade.
    for (const ids of chunkForInArray(removedInsertableIds)) {
        writes.push(db.delete(insertables).where(inArray(insertables.id, ids)));
    }
    writes.push(
        ...(await flagFailedInsertables(db, input.failedInsertableIds))
    );

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/**
 * Keeps the issues the last good load recorded. A new insertable has no row,
 * so the group's `INSERTABLES_FAILED` covers it.
 */
async function flagFailedInsertables(
    db: Db,
    failedInsertableIds: string[]
): Promise<BatchItem<"sqlite">[]> {
    // Chunked: a rate-limited load can fail more ids than one statement binds.
    const reads = await Promise.all(
        chunkForInArray(failedInsertableIds).map((ids) =>
            db
                .select({
                    id: insertables.id,
                    buildIssues: insertables.buildIssues
                })
                .from(insertables)
                .where(inArray(insertables.id, ids))
        )
    );

    return reads.flat().map((row) =>
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

export interface StoredInsertable {
    id: string;
    elementId: string;
    microversionId: string;
    /** So a row the last load failed on is retried. */
    buildIssues: BuildIssue[];
    /** Where the row sits now, which is what the tab order is compared against. */
    sortOrder: number;
}

async function fetchStoredInsertables(
    ctx: LoadContext,
    groupId: string
): Promise<StoredInsertable[]> {
    return getDb(ctx.env.DB)
        .select({
            id: insertables.id,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            buildIssues: insertables.buildIssues,
            sortOrder: insertables.sortOrder
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId));
}

/**
 * New tabs, changed ones, and ones the last load failed on: a failure writes no
 * microversion, so the tab would otherwise look unchanged.
 */
export function selectInsertablesToLoad(
    target: LoadingGroup,
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
            storedRow.microversionId === tab.microversionId &&
            !hasBuildIssue(storedRow.buildIssues, BuildIssueType.LOAD_FAILED)
        ) {
            return;
        }

        insertableTargets.push({
            insertableId: storedRow?.id ?? crypto.randomUUID(),
            libraryId: target.libraryId,
            groupId: target.groupId,
            elementPath: { ...target.versionPath, elementId: tab.id },
            versionCreatedAt: target.versionCreatedAt,
            thumbnailPath: { ...target.thumbnailPath, elementId: tab.id },
            // OnshapeElementType and the app ElementType share these values.
            elementType: tab.elementType as unknown as ElementType,
            name: tab.name,
            microversionId: tab.microversionId,
            sortOrder
        });
    });
    return insertableTargets;
}

export function findRemovedInsertables(
    insertableTabs: OnshapeElement[],
    storedInsertables: StoredInsertable[]
): string[] {
    const tabIds = new Set(insertableTabs.map((tab) => tab.id));
    return storedInsertables
        .filter((row) => !tabIds.has(row.elementId))
        .map((row) => row.id);
}

/** A stored insertable's new position in the document's tab order. */
interface InsertableOrder {
    insertableId: string;
    sortOrder: number;
}

/**
 * Stored rows the tab order moved. Reordering changes no microversion, so these
 * are usually rows the load skips, and the order is written here instead.
 */
export function findMovedInsertables(
    insertableTabs: OnshapeElement[],
    storedInsertables: StoredInsertable[]
): InsertableOrder[] {
    const storedByElementId = new Map(
        storedInsertables.map((row) => [row.elementId, row])
    );

    const moved: InsertableOrder[] = [];
    insertableTabs.forEach((tab, sortOrder) => {
        const storedRow = storedByElementId.get(tab.id);
        if (storedRow && storedRow.sortOrder !== sortOrder) {
            moved.push({ insertableId: storedRow.id, sortOrder });
        }
    });
    return moved;
}
