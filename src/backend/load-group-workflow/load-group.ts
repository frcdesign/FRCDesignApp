import {
    WorkflowEntrypoint,
    WorkflowEvent,
    WorkflowStep
} from "cloudflare:workers";
import { and, eq, notInArray } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { type Db, getDb } from "../db";
import type { InstancePath } from "../../shared/onshape-path";
import {
    ElementType,
    type LibraryId,
    type ThumbnailUrls
} from "../../shared/types";
import { groups, insertables, libraries } from "../../shared/schema";
import {
    uploadDocumentThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import {
    bumpLibraryVersion,
    placeNewGroup,
    rebuildSearchDb
} from "../library-data";
import { getContents, getDocument } from "../onshape-api/endpoints/documents";
import { OnshapeApi } from "../onshape-api/onshape-api";
import {
    OnshapeDocumentContents,
    OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { checkGroup } from "../parse/build-checks";
import { LoadInsertable, type LoadInsertableData } from "./load-insertable";

// ---------------------------------------------------------------------------
// Data-flow types — each element flows DocumentElement → MatchedInsertable →
// LoadInsertableData, so every stage's contents are explicit and named.
// ---------------------------------------------------------------------------

/** A part studio / assembly element (tab) from the Onshape document contents. */
export interface DocumentElement {
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
}

/** Document metadata + ordered element list (output of the fetch-contents step). */
export interface DocumentInfo {
    docName: string;
    /** The document's most recently created version. */
    versionId: string;
    thumbnailElementId?: string;
    /** The valid (part studio / assembly) elements. */
    elements: DocumentElement[];
    /** Valid element ids in display (folder-tree) order. */
    orderedElementIds: string[];
}

/**
 * A document element matched against the database. It carries only the fields the
 * match phase decides — whether it's new, its position, and its stored microversion
 * (to decide whether it needs reloading). Everything else — including the insertable's
 * own id — is resolved by `LoadInsertable` itself, right where it's needed.
 */
export interface MatchedInsertable {
    isNew: boolean;
    element: DocumentElement;
    /** Position in the document's ordered element list. */
    sortOrder: number;
    /** The microversion currently stored in the DB (null for a new element). */
    storedMicroversionId: string | null;
}

/** The shared context every loaded insertable needs but that isn't part of the element itself. */
interface GroupContext {
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    versionId: string;
}

/** Whether the group row needs creating (after `selectedGroupId`) or already exists. */
type GroupCreation =
    | { isNew: true; selectedGroupId: string | undefined }
    | { isNew: false };

export type LoadGroupParams = {
    /** The group to sync. */
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    sessionId: string;
    forceReload?: boolean;
} & GroupCreation;

/**
 * Syncs an Onshape document into a library's group.
 *
 * `run()` is a thin orchestrator: it sequences the group-level steps, then hands each
 * element off to its own `LoadInsertable`, which loads and persists that insertable
 * independently — a single element's exhausted retries don't block the rest of the
 * group, and its stale `microversionId` naturally queues it for the next reload.
 */
export class LoadGroupWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadGroupParams
> {
    async run(
        event: WorkflowEvent<LoadGroupParams>,
        step: WorkflowStep
    ): Promise<void> {
        const {
            groupId,
            documentId,
            libraryId,
            sessionId,
            forceReload = false
        } = event.payload;
        const creation: GroupCreation = event.payload.isNew
            ? { isNew: true, selectedGroupId: event.payload.selectedGroupId }
            : { isNew: false };

        // Fetch document metadata (including its version) + contents (the valid
        // elements, in order) together, so the document is only fetched once.
        const docInfo = await step.do("fetch-contents", () =>
            this.fetchContents(sessionId, documentId)
        );

        const instancePath: InstancePath = {
            documentId,
            instanceId: docInfo.versionId,
            instanceType: "v"
        };
        const ctx: GroupContext = {
            groupId,
            documentId,
            libraryId,
            versionId: docInfo.versionId
        };

        // Match each element to an existing insertable, assigning fresh ids to new
        // elements. Ids are generated inside the step so replays are stable.
        const matched = await step.do("match-elements", () =>
            this.resolveMatches(groupId, docInfo)
        );

        // Upload document-level thumbnails (with retry).
        const docThumbnailUrls = await uploadThumbnailsWithRetry(
            step,
            `doc-thumbnail-${documentId}`,
            async () =>
                uploadDocumentThumbnails(
                    this.env.THUMBNAILS,
                    await this.api(sessionId),
                    instancePath
                )
        );

        // Load and persist the elements that need reloading — each insertable writes
        // its own row independently, so one element's exhausted retries don't prevent
        // the others (or the group finalization below) from succeeding.
        await Promise.all(
            getInsertablesToReload(matched, forceReload).map(
                async (matched) => {
                    const insertableLoad = new LoadInsertable(
                        { env: this.env, sessionId },
                        toLoadInsertableData(matched, ctx)
                    );
                    try {
                        await insertableLoad.run(step);
                    } catch {
                        // Leave the stale microversionId in place — a later reload retries
                        // just this element.
                    }
                }
            )
        );

        // Create or update the group row, and delete insertables removed from the document.
        await step.do("save-group", () =>
            this.saveGroup(ctx, docInfo, docThumbnailUrls, creation)
        );

        // Rebuild the library's search index and bump the cache version.
        await step.do("rebuild-search-db", () => this.rebuildSearch(libraryId));
    }

    /** Resolves the Onshape client for a session (fresh per step, for replay-safety). */
    private api(sessionId: string): Promise<OnshapeApi> {
        return getOnshapeApiForSessionId(this.env.KV, sessionId);
    }

    /**
     * Document metadata (including its most recently created version) + the valid
     * elements in display order. Fetches the document itself only once — its version
     * is folded in here rather than resolved as a separate step.
     */
    private async fetchContents(
        sessionId: string,
        documentId: string
    ): Promise<DocumentInfo> {
        const api = await this.api(sessionId);
        const rawDoc = await getDocument(api, { documentId });
        const versionId = rawDoc.recentVersion.id;
        const instancePath: InstancePath = {
            documentId,
            instanceId: versionId,
            instanceType: "v"
        };
        const rawContents = await getContents(api, instancePath);

        const elements = getValidElements(rawContents);
        const validElementIds = new Set(elements.map((e) => e.elementId));
        const orderedElementIds = getOrderedElementIds(rawContents).filter(
            (id) => validElementIds.has(id)
        );

        return {
            docName: rawDoc.name,
            versionId,
            thumbnailElementId: rawDoc.documentThumbnailElementId,
            elements,
            orderedElementIds
        };
    }

    private resolveMatches(
        groupId: string,
        docInfo: DocumentInfo
    ): Promise<MatchedInsertable[]> {
        return matchElements(getDb(this.env.DB), groupId, docInfo);
    }

    /**
     * Creates or updates the group row (depending on `creation`) and deletes
     * insertables that are no longer valid (removed from the document entirely).
     * Per-insertable rows are written independently by each `LoadInsertable` — this
     * only owns the group-level fields.
     */
    private async saveGroup(
        ctx: GroupContext,
        docInfo: DocumentInfo,
        docThumbnailUrls: ThumbnailUrls | null,
        creation: GroupCreation
    ): Promise<void> {
        const db = getDb(this.env.DB);

        const buildIssues = checkGroup({
            hasThumbnailTab: !!docInfo.thumbnailElementId,
            thumbnailUrls: docThumbnailUrls
        });

        const validElementIds = docInfo.elements.map((e) => e.elementId);
        const deleteStaleInsertables =
            validElementIds.length > 0
                ? db
                      .delete(insertables)
                      .where(
                          and(
                              eq(insertables.groupId, ctx.groupId),
                              notInArray(insertables.elementId, validElementIds)
                          )
                      )
                : db
                      .delete(insertables)
                      .where(eq(insertables.groupId, ctx.groupId));

        if (creation.isNew) {
            await db
                .insert(libraries)
                .values({ id: ctx.libraryId })
                .onConflictDoNothing();
            // Computed here, right before the insert, so placement and creation happen
            // together — a step.do retry re-derives the same position safely, since the
            // new group still isn't among the siblings placeNewGroup queries/renumbers.
            const sortOrder = await placeNewGroup(
                db,
                ctx.libraryId,
                ctx.groupId,
                creation.selectedGroupId
            );
            const groupInsert = db.insert(groups).values({
                id: ctx.groupId,
                documentId: ctx.documentId,
                libraryId: ctx.libraryId,
                name: docInfo.docName,
                versionId: ctx.versionId,
                sortOrder,
                thumbnailUrls: docThumbnailUrls,
                buildIssues
            });
            await db.batch([groupInsert, deleteStaleInsertables]);
            return;
        }

        const groupUpdate = db
            .update(groups)
            .set({
                name: docInfo.docName,
                versionId: ctx.versionId,
                thumbnailUrls: docThumbnailUrls,
                buildIssues
            })
            .where(eq(groups.id, ctx.groupId));
        await db.batch([groupUpdate, deleteStaleInsertables]);
    }

    private async rebuildSearch(libraryId: LibraryId): Promise<void> {
        const db = getDb(this.env.DB);
        await rebuildSearchDb(db, libraryId);
        await bumpLibraryVersion(db, libraryId);
    }
}

// ---------------------------------------------------------------------------
// Pure helpers for the document contents tree.
// ---------------------------------------------------------------------------

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

function* traverseEntry(entry: OnshapeFolderEntry): Generator<string> {
    if (entry.btType === OnshapeFolderEntryType.GROUP) {
        for (const child of entry.groups) yield* traverseEntry(child);
    } else if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
        yield entry.elementId;
    }
}

/** Element ids in display (folder-tree) order. */
export function getOrderedElementIds(
    contents: OnshapeDocumentContents
): string[] {
    const ids: string[] = [];
    for (const entry of contents.folders.groups) {
        ids.push(...traverseEntry(entry));
    }
    return ids;
}

/** The part studio / assembly elements we load, with the fields we persist. */
export function getValidElements(
    contents: OnshapeDocumentContents
): DocumentElement[] {
    return contents.elements
        .filter((e) => VALID_ELEMENT_TYPES.has(e.elementType))
        .map((e) => ({
            elementId: e.id,
            name: e.name,
            // OnshapeElementType and the app ElementType share these values.
            elementType: e.elementType as unknown as ElementType,
            microversionId: e.microversionId
        }));
}

// ---------------------------------------------------------------------------
// Pure element helpers.
// ---------------------------------------------------------------------------

/**
 * Matches each document element against the database (selected by groupId +
 * elementId — groupId alone is enough, since it already uniquely scopes a group's
 * insertables) to decide whether it's new and, if not, its stored microversion.
 */
export async function matchElements(
    db: Db,
    groupId: string,
    docInfo: DocumentInfo
): Promise<MatchedInsertable[]> {
    const sortOrderByElementId = new Map(
        docInfo.orderedElementIds.map((id, i) => [id, i])
    );
    return Promise.all(
        docInfo.elements.map(async (element) => {
            const sortOrder = sortOrderByElementId.get(element.elementId) ?? 0;
            const match = await db
                .select({ microversionId: insertables.microversionId })
                .from(insertables)
                .where(
                    and(
                        eq(insertables.groupId, groupId),
                        eq(insertables.elementId, element.elementId)
                    )
                )
                .get();

            return {
                element,
                sortOrder,
                isNew: !match,
                storedMicroversionId: match?.microversionId ?? null
            };
        })
    );
}

/** The matched elements that need (re)loading from Onshape. */
export function getInsertablesToReload(
    matched: MatchedInsertable[],
    forceReload: boolean
): MatchedInsertable[] {
    if (forceReload) {
        return matched;
    }
    return matched.filter(
        (m) => m.isNew || m.storedMicroversionId !== m.element.microversionId
    );
}

/** Builds one element's `LoadInsertable` data from its match + the group context. */
function toLoadInsertableData(
    matched: MatchedInsertable,
    ctx: GroupContext
): LoadInsertableData {
    const { element } = matched;
    return {
        groupId: ctx.groupId,
        documentId: ctx.documentId,
        libraryId: ctx.libraryId,
        versionId: ctx.versionId,
        elementPath: {
            documentId: ctx.documentId,
            instanceId: ctx.versionId,
            instanceType: "v",
            elementId: element.elementId
        },
        name: element.name,
        elementType: element.elementType,
        microversionId: element.microversionId,
        sortOrder: matched.sortOrder
    };
}
