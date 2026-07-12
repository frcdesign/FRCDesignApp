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
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { checkGroup } from "../parse/build-checks";
import { loadInsertable } from "./load-insertable";
import {
    type GroupContext,
    type GroupFields,
    type InsertableElement,
    type LoadContext,
    api,
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

    const diff = await ctx.step.do(`diff-${groupId}`, () =>
        diffGroup(ctx, groupId, versionId, forceReload)
    );
    const groupCtx: GroupContext = { ...ctx, ...diff.group };

    const versionPath: InstancePath = {
        documentId: diff.group.documentId,
        instanceId: versionId,
        instanceType: "v"
    };
    const docThumbnails = uploadThumbnailsStep(
        ctx,
        `document-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                ctx.env.THUMBNAILS,
                await api(ctx),
                versionPath
            )
    );

    const failedElementIds: string[] = [];
    await Promise.all(
        diff.toLoad.map(async (element) => {
            try {
                await loadInsertable(groupCtx, element);
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
        if (diff.staleIds.length === 0) {
            await groupWrite;
            return;
        }
        // Configurations and favorites follow deleted insertables via their
        // cascading foreign keys.
        await db.batch([
            groupWrite,
            db.delete(insertables).where(inArray(insertables.id, diff.staleIds))
        ]);
    });

    return {
        loadedElements: diff.toLoad.length,
        deletedElements: diff.staleIds.length
    };
}

// ---------------------------------------------------------------------------
// The diff step — everything the load needs, resolved in one memoized step.
// ---------------------------------------------------------------------------

export interface GroupDiff {
    group: GroupFields;
    toLoad: InsertableElement[];
    /** Rows whose element no longer exists in the document. */
    staleIds: string[];
}

/**
 * The diff step body: resolves the group's shared fields from its row, then
 * diffs the document's tabs against the stored insertables. Freshly minted
 * ids are generated here, inside the memoized step, so they're stable across
 * every replay.
 */
async function diffGroup(
    ctx: LoadContext,
    groupId: string,
    versionId: string,
    forceReload: boolean
): Promise<GroupDiff> {
    const db = getDb(ctx.env.DB);

    const groupRow = await db
        .select({ documentId: group.documentId, libraryId: group.libraryId })
        .from(group)
        .where(eq(group.id, groupId))
        .get();
    if (!groupRow) {
        throw new NonRetryableError(`Group ${groupId} does not exist`);
    }

    const contents = await getContents(await api(ctx), {
        documentId: groupRow.documentId,
        instanceId: versionId,
        instanceType: "v"
    });

    const stored: StoredInsertable[] = await db
        .select({
            id: insertables.id,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            supportsFasten: insertables.supportsFasten
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId));

    return {
        group: {
            libraryId: groupRow.libraryId,
            groupId,
            documentId: groupRow.documentId,
            versionId
        },
        ...diffElements(parseContents(contents), stored, forceReload)
    };
}

/** The stored fields the diff consults. */
export interface StoredInsertable {
    id: string;
    elementId: string;
    microversionId: string;
    supportsFasten: boolean;
}

/**
 * Pure diff of the document's tabs (in display order) against the stored
 * rows: which elements to (re)load — new, changed microversion, or all on
 * forceReload — and which rows to delete. Unchanged elements are simply left
 * alone.
 */
export function diffElements(
    tabs: DocumentElement[],
    stored: StoredInsertable[],
    forceReload: boolean
): { toLoad: InsertableElement[]; staleIds: string[] } {
    const storedByElementId = new Map(
        stored.map((row) => [row.elementId, row])
    );

    const toLoad: InsertableElement[] = [];
    tabs.forEach((tab, sortOrder) => {
        const row = storedByElementId.get(tab.elementId);
        if (row && !forceReload && row.microversionId === tab.microversionId) {
            return;
        }
        toLoad.push({
            ...tab,
            insertableId: row?.id ?? crypto.randomUUID(),
            supportsFasten: row?.supportsFasten ?? false,
            sortOrder
        });
    });

    const tabIds = new Set(tabs.map((tab) => tab.elementId));
    const staleIds = stored
        .filter((row) => !tabIds.has(row.elementId))
        .map((row) => row.id);

    return { toLoad, staleIds };
}

// ---------------------------------------------------------------------------
// Pure helpers for the document contents tree.
// ---------------------------------------------------------------------------

/** A part studio / assembly tab from the Onshape document contents. */
export interface DocumentElement {
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
}

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/**
 * The part studio / assembly tabs we load, sorted into display (folder-tree)
 * order — their index is the seed sortOrder. Tabs missing from the folder
 * tree sort last.
 */
export function parseContents(
    contents: OnshapeDocumentContents
): DocumentElement[] {
    const tabs = contents.elements
        .filter((e) => VALID_ELEMENT_TYPES.has(e.elementType))
        .map((e) => ({
            elementId: e.id,
            name: e.name,
            // OnshapeElementType and the app ElementType share these values.
            elementType: e.elementType as unknown as ElementType,
            microversionId: e.microversionId
        }));

    const displayOrder = new Map(
        orderedElementIds(contents).map((id, index) => [id, index])
    );
    const orderOf = (tab: DocumentElement) =>
        displayOrder.get(tab.elementId) ?? Infinity;
    return tabs.sort((a, b) => orderOf(a) - orderOf(b));
}

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
