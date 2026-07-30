import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "../db";
import { ElementType } from "../../shared/types";
import type { ThumbnailUrls } from "../../shared/types";
import type { BuildIssue } from "../../shared/build-checker";
import { group, insertables } from "../../shared/schema";
import { uploadDocumentThumbnails } from "../routes/thumbnails";
import { getContents } from "../onshape-api/endpoints/documents";
import {
    type OnshapeDocumentContents,
    type OnshapeDocumentInfo,
    type OnshapeElement,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { checkGroup } from "../parse/build-checks";
import { loadInsertable } from "./load-insertable";
import {
    type GroupTarget,
    type InsertableTarget,
    type LoadContext,
    getOnshapeApiFromContext,
    uploadThumbnailsStep
} from "./load-utils";
import type { InstancePath } from "../../shared/onshape-path";

export interface GroupLoadResult {
    loadedElements: number;
    deletedElements: number;
}

/**
 * The fields a reload overwrites on the group row. Everything else is either
 * identity (id, documentId, libraryId) or owned by AddGroup / the user and
 * preserved across reloads (sortOrder, sortAlphabetically).
 */
export interface ReloadedGroupFields {
    name: string;
    versionId: string;
    thumbnailUrls: ThumbnailUrls | null;
    buildIssues: BuildIssue[];
}

export async function loadGroup(
    ctx: LoadContext,
    target: GroupTarget,
    document: OnshapeDocumentInfo,
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

    const failedElementIds: string[] = [];
    await Promise.all(
        insertablesToLoad.map(async (insertableTarget) => {
            try {
                await loadInsertable(ctx, insertableTarget);
            } catch {
                failedElementIds.push(insertableTarget.elementPath.elementId);
            }
        })
    );

    if (failedElementIds.length > 0) {
        throw new Error(
            `Group ${groupId}: elements failed to load: ` +
                failedElementIds.join(", ")
        );
    }

    const docThumbnailUrls = await uploadThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromContext(ctx),
                versionPath
            )
    );

    await ctx.step.do(`save-group-${groupId}`, async () => {
        const reloaded: ReloadedGroupFields = {
            name: document.name,
            versionId: versionPath.instanceId,
            thumbnailUrls: docThumbnailUrls,
            buildIssues: checkGroup({
                hasThumbnailTab: !!document.documentThumbnailElementId,
                thumbnailUrls: docThumbnailUrls
            })
        };

        const db = getDb(ctx.env.DB);
        const writes: BatchItem<"sqlite">[] = [
            db.update(group).set(reloaded).where(eq(group.id, groupId))
        ];
        if (removedInsertableIds.length > 0) {
            // Configurations and favorites follow deleted insertables via their
            // cascading foreign keys.
            writes.push(
                db
                    .delete(insertables)
                    .where(inArray(insertables.id, removedInsertableIds))
            );
        }
        await db.batch(
            writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
        );
    });

    return {
        loadedElements: insertablesToLoad.length,
        deletedElements: removedInsertableIds.length
    };
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
 * What an existing insertable row contributes to the reload decision: its id, so
 * a reload keeps it, and its microversion, to tell whether it changed.
 */
export interface StoredInsertable {
    id: string;
    elementId: string;
    microversionId: string;
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

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/**
 * The part studio / assembly tabs we load, in the order they appear in the
 * document's tab bar.
 *
 * `contents.elements` is unordered, and `contents.folders` is the folder tree
 * that defines display order — so walk the tree and pick up each tab as it is
 * encountered. Onshape has been known to omit a tab from the tree, so anything
 * left over is appended rather than dropped.
 */
export function parseInsertableTabs(
    contents: OnshapeDocumentContents
): OnshapeElement[] {
    const remaining = new Map(
        contents.elements
            .filter((element) => VALID_ELEMENT_TYPES.has(element.elementType))
            .map((element) => [element.id, element])
    );

    const tabs: OnshapeElement[] = [];
    for (const elementId of traverseFolders(contents.folders.groups)) {
        const tab = remaining.get(elementId);
        if (tab) {
            tabs.push(tab);
            remaining.delete(elementId);
        }
    }
    return [...tabs, ...remaining.values()];
}

/** Yields each elementId in a folder tree, depth-first, in display order. */
function* traverseFolders(entries: OnshapeFolderEntry[]): Generator<string> {
    for (const entry of entries) {
        if (entry.btType === OnshapeFolderEntryType.GROUP) {
            yield* traverseFolders(entry.groups);
        } else if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
            yield entry.elementId;
        }
    }
}
