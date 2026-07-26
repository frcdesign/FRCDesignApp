import { NonRetryableError } from "cloudflare:workflows";
import { eq, inArray } from "drizzle-orm";
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
    type InsertableGroupFields,
    type InsertableElement,
    type LoadContext,
    getOnshapeApiFromLoadContext,
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
    groupId: string,
    document: OnshapeDocumentInfo,
    forceReload: boolean
): Promise<GroupLoadResult> {
    const versionId = document.recentVersion.id;

    // Resolve the group's stored identity (documentId, libraryId).
    const groupFields = await ctx.step.do(`group-fields-${groupId}`, () =>
        resolveGroupFields(ctx, groupId, versionId)
    );

    // Read the document's loadable tabs (display order) and the stored rows.
    const tabs = await ctx.step.do(`contents-${groupId}`, () =>
        fetchDocumentTabs(ctx, groupFields.documentId, versionId)
    );
    const storedInsertables = await ctx.step.do(
        `stored-insertables-${groupId}`,
        () => fetchStoredInsertables(ctx, groupId)
    );

    // Select the elements to (re)load. Ids for new elements are minted inside
    // the step so replays reuse them; orphan detection below is pure.
    const toLoad = await ctx.step.do(`select-elements-${groupId}`, () =>
        Promise.resolve(
            selectElementsToLoad(tabs, storedInsertables, forceReload)
        )
    );
    const staleIds = findOrphanedRows(tabs, storedInsertables);

    const versionPath: InstancePath = {
        documentId: groupFields.documentId,
        instanceId: versionId,
        instanceType: "v"
    };
    const docThumbnails = uploadThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                ctx.env.THUMBNAILS,
                await getOnshapeApiFromLoadContext(ctx),
                versionPath
            )
    );

    const failedElementIds: string[] = [];
    await Promise.all(
        toLoad.map(async (element) => {
            try {
                await loadInsertable(ctx, groupFields, element);
            } catch {
                failedElementIds.push(element.elementId);
            }
        })
    );

    const docThumbnailUrls = await docThumbnails;

    if (failedElementIds.length > 0) {
        throw new Error(
            `Group ${groupId}: elements failed to load: ` +
                failedElementIds.join(", ")
        );
    }

    await ctx.step.do(`save-group-${groupId}`, async () => {
        const reloaded: ReloadedGroupFields = {
            name: document.name,
            versionId,
            thumbnailUrls: docThumbnailUrls,
            buildIssues: checkGroup({
                hasThumbnailTab: !!document.documentThumbnailElementId,
                thumbnailUrls: docThumbnailUrls
            })
        };

        const db = getDb(ctx.env.DB);
        const groupWrite = db
            .update(group)
            .set(reloaded)
            .where(eq(group.id, groupId));
        if (staleIds.length === 0) {
            await groupWrite;
            return;
        }
        // Configurations and favorites follow deleted insertables via their
        // cascading foreign keys.
        await db.batch([
            groupWrite,
            db.delete(insertables).where(inArray(insertables.id, staleIds))
        ]);
    });

    return {
        loadedElements: toLoad.length,
        deletedElements: staleIds.length
    };
}

/**
 * Resolves the group's stored identity from its row.
 */
async function resolveGroupFields(
    ctx: LoadContext,
    groupId: string,
    versionId: string
): Promise<InsertableGroupFields> {
    const groupRow = await getDb(ctx.env.DB)
        .select({ documentId: group.documentId, libraryId: group.libraryId })
        .from(group)
        .where(eq(group.id, groupId))
        .get();
    if (!groupRow) {
        throw new NonRetryableError(`Group ${groupId} does not exist`);
    }
    return {
        libraryId: groupRow.libraryId,
        groupId,
        documentId: groupRow.documentId,
        versionId
    };
}

/**
 * Fetches the document's part studio / assembly tabs, in display order.
 */
async function fetchDocumentTabs(
    ctx: LoadContext,
    documentId: string,
    versionId: string
): Promise<OnshapeElement[]> {
    const contents = await getContents(
        await getOnshapeApiFromLoadContext(ctx),
        {
            documentId,
            instanceId: versionId,
            instanceType: "v"
        }
    );
    return parseContents(contents);
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
            microversionId: insertables.microversionId,
            supportsFasten: insertables.supportsFasten,
            searchPartNumbers: insertables.searchPartNumbers
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId));
}

/**
 * Relevant fields pulled from existing insertables.
 */
export interface StoredInsertable {
    id: string;
    elementId: string;
    microversionId: string;
    supportsFasten: boolean;
    searchPartNumbers: boolean;
}

/**
 * Selects document tabs
 */
export function selectElementsToLoad(
    tabs: OnshapeElement[],
    stored: StoredInsertable[],
    forceReload: boolean
): InsertableElement[] {
    const storedByElementId = new Map(
        stored.map((row) => [row.elementId, row])
    );

    const toLoad: InsertableElement[] = [];
    tabs.forEach((tab, sortOrder) => {
        const row = storedByElementId.get(tab.id);
        if (row && !forceReload && row.microversionId === tab.microversionId) {
            return;
        }
        toLoad.push({
            insertableId: row?.id ?? crypto.randomUUID(),
            elementId: tab.id,
            name: tab.name,
            // OnshapeElementType and the app ElementType share these values.
            elementType: tab.elementType as unknown as ElementType,
            microversionId: tab.microversionId,
            supportsFasten: row?.supportsFasten ?? false,
            searchPartNumbers: row?.searchPartNumbers ?? false,
            sortOrder
        });
    });
    return toLoad;
}

/**
 * Finds the stored rows whose element no longer exists in the document; their
 * ids are the rows to delete.
 */
export function findOrphanedRows(
    tabs: OnshapeElement[],
    storedInsertables: StoredInsertable[]
): string[] {
    const tabIds = new Set(tabs.map((tab) => tab.id));
    return storedInsertables
        .filter((row) => !tabIds.has(row.elementId))
        .map((row) => row.id);
}

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/**
 * The part studio / assembly tabs we load, sorted in display (folder-tree) order.
 */
export function parseContents(
    contents: OnshapeDocumentContents
): OnshapeElement[] {
    const tabs = contents.elements.filter((e) =>
        VALID_ELEMENT_TYPES.has(e.elementType)
    );

    const displayOrder = new Map(
        orderedElementIds(contents).map((id, index) => [id, index])
    );
    const orderOf = (tab: OnshapeElement) =>
        displayOrder.get(tab.id) ?? Infinity;
    return tabs.sort((a, b) => orderOf(a) - orderOf(b));
}

/**
 * Iterates over an Onshape folder tree, returning each elementId in the order they're encountered.
 */
function* traverseEntry(entry: OnshapeFolderEntry): Generator<string> {
    if (entry.btType === OnshapeFolderEntryType.GROUP) {
        for (const child of entry.groups) yield* traverseEntry(child);
    } else if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
        yield entry.elementId;
    }
}

/** Element ids in display (folder-tree) order. */
function orderedElementIds(contents: OnshapeDocumentContents): string[] {
    const ids: string[] = [];
    for (const entry of contents.folders.groups) {
        ids.push(...traverseEntry(entry));
    }
    return ids;
}
