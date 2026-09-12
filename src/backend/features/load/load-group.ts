import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Db, getDb } from "../../db/client";
import { chunkForInArray } from "../../db/chunk";
import { ElementType } from "../../lib/onshape/element-type";
import type { ThumbnailUrls } from "../thumbnails/contract";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType
} from "../build-checker/issues";
import { groups, insertables } from "../../db/schema";
import {
    readThumbnailUrls,
    resolveDocumentThumbnail
} from "../thumbnails/store";
import { getContents } from "../../lib/onshape/endpoints/documents";
import type { OnshapeElement } from "../../lib/onshape/types";
import { checkGroup } from "../build-checker/checks";
import { parseInsertableTabs } from "./parse-document-contents";
import { loadInsertable } from "./load-insertable";
import {
    type GroupTarget,
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./context";
import { ONSHAPE_STEP_RETRIES, queueThumbnailsStep } from "./steps";
import type { InstancePath } from "../../lib/onshape/path";

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
}

export async function loadGroup(
    ctx: LoadContext,
    target: GroupTarget,
    forceReload: boolean
): Promise<GroupLoadResult> {
    const { groupId, versionPath, workspacePath } = target;

    // Read the document's loadable tabs (display order) and the stored rows.
    const insertableTabs = await ctx.step.do(
        `insertable-tabs-${groupId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        () => fetchInsertableTabs(ctx, versionPath)
    );
    // The same document as the workspace sees it, which is where thumbnails
    // are read from. A tab can be in the version and gone from the workspace,
    // and then there is nothing to read.
    const workspaceTabs = await ctx.step.do(
        `workspace-tabs-${groupId}`,
        { retries: ONSHAPE_STEP_RETRIES },
        () => fetchInsertableTabs(ctx, workspacePath)
    );
    const storedInsertables = await ctx.step.do(
        `stored-insertables-${groupId}`,
        () => fetchStoredInsertables(ctx, groupId)
    );

    // Wrap in a step so new UUIDs are deterministic
    const selected = await ctx.step.do(`select-insertables-${groupId}`, () =>
        Promise.resolve(
            selectInsertablesToLoad(
                target,
                insertableTabs,
                storedInsertables,
                forceReload
            )
        )
    );
    const inWorkspace = new Set(workspaceTabs.map((tab) => tab.id));
    const insertablesToLoad = selected.map((insertable) => ({
        ...insertable,
        workspacePath: inWorkspace.has(insertable.elementPath.elementId)
            ? { ...workspacePath, elementId: insertable.elementPath.elementId }
            : undefined
    }));
    // Removal detection is pure, so it needs no step.
    const removedInsertableIds = findRemovedInsertables(
        insertableTabs,
        storedInsertables
    );

    const failedInsertableIds = await loadInsertables(ctx, insertablesToLoad);

    const thumbnailUrls = await loadDocumentThumbnail(ctx, target, inWorkspace);

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
 * Starts every selected insertable at once, returning the ids of the ones that
 * failed. `loadInsertable` holds a limiter slot for the part of itself that
 * asks Onshape anything, so what runs in parallel here is bounded there.
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
            } catch {
                failedInsertableIds.push(target.insertableId);
            }
        })
    );
    return failedInsertableIds;
}

/**
 * The group's own thumbnail. Which element it comes from is its own question,
 * asked here rather than in the renderer, which only renders.
 */
async function loadDocumentThumbnail(
    ctx: LoadContext,
    target: GroupTarget,
    inWorkspace: Set<string>
): Promise<ThumbnailUrls | null> {
    const { groupId, versionPath, workspacePath } = target;

    // Never fatal: `checkGroup` already flags a missing thumbnail, and failing
    // the load over a cosmetic one would lose the group's insertables.
    let element;
    try {
        element = await ctx.step.do(
            `document-thumbnail-element-${groupId}`,
            { retries: ONSHAPE_STEP_RETRIES },
            async () =>
                resolveDocumentThumbnail(
                    await getOnshapeApiFromContext(ctx),
                    versionPath
                )
        );
    } catch {
        return null;
    }

    return queueThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        {
            kind: "element",
            elementPath: element.elementPath,
            workspacePath: inWorkspace.has(element.elementPath.elementId)
                ? {
                      ...workspacePath,
                      elementId: element.elementPath.elementId
                  }
                : undefined,
            microversionId: element.microversionId,
            owner: {
                kind: "group",
                libraryId: target.libraryId,
                groupId
            }
        },
        () =>
            readThumbnailUrls(
                ctx.env.BLOB,
                element.elementPath.elementId,
                element.microversionId
            )
    );
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
        lastLoadedAt: new Date()
    };
    if (!hasFailedInsertables) {
        parsed.versionId = target.versionPath.instanceId;
    }

    const writes: BatchItem<"sqlite">[] = [
        db.update(groups).set(parsed).where(eq(groups.id, target.groupId))
    ];
    if (!hasFailedInsertables) {
        // A skipped tab never reaches saveInsertable, so move the whole group
        // forward: the stale id is what insertion and document links use.
        writes.push(
            db
                .update(insertables)
                .set({ versionId: target.versionPath.instanceId })
                .where(eq(insertables.groupId, target.groupId))
        );
    }
    // Configurations and favorites follow deleted insertables via their
    // cascading foreign keys.
    for (const ids of chunkForInArray(removedInsertableIds)) {
        writes.push(db.delete(insertables).where(inArray(insertables.id, ids)));
    }
    writes.push(
        ...(await flagFailedInsertables(db, input.failedInsertableIds))
    );

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/**
 * Keeps the issues the last good load recorded. A brand-new insertable has no
 * row yet, so the group's `INSERTABLES_FAILED` covers it instead.
 */
async function flagFailedInsertables(
    db: Db,
    failedInsertableIds: string[]
): Promise<BatchItem<"sqlite">[]> {
    // Chunked: a rate-limited load can fail more insertables at once than one
    // statement can bind ids for.
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
 * New tabs, and stored ones whose microversion changed. A stored insertable
 * keeps its id so favorites and links survive.
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
