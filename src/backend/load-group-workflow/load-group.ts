import {
    WorkflowEntrypoint,
    WorkflowEvent,
    WorkflowStep
} from "cloudflare:workers";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { type Db, getDb } from "../db";
import type { InstancePath } from "../../shared/onshape-path";
import {
    ElementType,
    type LibraryId,
    type ThumbnailUrls
} from "../../shared/types";
import {
    configurations,
    groups,
    insertables,
    libraries
} from "../../shared/schema";
import {
    uploadDocumentThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
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
// Data-flow types — each element flows DocumentElement → MatchedElement →
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
    thumbnailElementId?: string;
    /** The valid (part studio / assembly) elements. */
    elements: DocumentElement[];
    /** Valid element ids in display (folder-tree) order. */
    orderedElementIds: string[];
}

/** The fields of an existing insertable row we need to match against. */
export interface ExistingInsertable {
    elementId: string;
    insertableId: string;
    microversionId: string;
    supportsFasten: boolean;
    hasConfiguration: boolean;
}

/**
 * A document element matched against the database. It carries only the fields the
 * match phase decides — the existing insertable id (or a fresh one for a new element),
 * its position, and the reload/fasten metadata. Everything else on the saved row is
 * rederived at load time (see `toInsertableRow` in `./load-insertable`), so nothing is
 * stored twice.
 */
export interface MatchedElement {
    isNew: boolean;
    element: DocumentElement;
    /** The insertable id to write: an existing row's id, or a fresh one for a new element. */
    insertableId: string;
    /** Position in the document's ordered element list. */
    sortOrder: number;
    /** The microversion currently stored in the DB (null for a new element). */
    storedMicroversionId: string | null;
    /** Stored insert-and-fasten preference — gates re-parsing fasten info on reload. */
    supportsFasten: boolean;
    /** Whether this insertable already has a `configurations` row. */
    hasConfiguration: boolean;
}

/** The shared context every loaded insertable needs but that isn't part of the element itself. */
interface GroupContext {
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    versionId: string;
}

/** Whether the group row needs creating (with its sort position) or already exists. */
type GroupCreation = { isNew: true; sortOrder: number } | { isNew: false };

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
            ? { isNew: true, sortOrder: event.payload.sortOrder }
            : { isNew: false };

        const versionId = await step.do("fetch-version", () =>
            this.fetchVersionId(sessionId, documentId)
        );

        const instancePath: InstancePath = {
            documentId,
            instanceId: versionId,
            instanceType: "v"
        };
        const ctx: GroupContext = { groupId, documentId, libraryId, versionId };

        // Fetch document contents (metadata + the valid elements, in order).
        const docInfo = await step.do("fetch-contents", () =>
            this.fetchContents(sessionId, instancePath)
        );

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

    /** The id of the document's most recently created version. */
    private async fetchVersionId(
        sessionId: string,
        documentId: string
    ): Promise<string> {
        const api = await this.api(sessionId);
        const doc = await getDocument(api, { documentId });
        return doc.recentVersion.id;
    }

    /** Document metadata + the valid elements in display order. */
    private async fetchContents(
        sessionId: string,
        instancePath: InstancePath
    ): Promise<DocumentInfo> {
        const api = await this.api(sessionId);
        const [rawDoc, rawContents] = await Promise.all([
            getDocument(api, instancePath),
            getContents(api, instancePath)
        ]);

        const elements = getValidElements(rawContents);
        const validElementIds = new Set(elements.map((e) => e.elementId));
        const orderedElementIds = getOrderedElementIds(rawContents).filter(
            (id) => validElementIds.has(id)
        );

        return {
            docName: rawDoc.name,
            thumbnailElementId: rawDoc.documentThumbnailElementId,
            elements,
            orderedElementIds
        };
    }

    private async resolveMatches(
        groupId: string,
        docInfo: DocumentInfo
    ): Promise<MatchedElement[]> {
        const existing = await fetchExistingInsertables(
            getDb(this.env.DB),
            groupId
        );
        return matchElements(docInfo, existing, () => crypto.randomUUID());
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
            const groupInsert = db.insert(groups).values({
                id: ctx.groupId,
                documentId: ctx.documentId,
                libraryId: ctx.libraryId,
                name: docInfo.docName,
                versionId: ctx.versionId,
                sortOrder: creation.sortOrder,
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
 * The existing insertables for a group, by the fields we match on, including whether
 * each already has a `configurations` row (a separate query, since configuration
 * existence isn't tracked on the insertable row itself).
 */
async function fetchExistingInsertables(
    db: Db,
    groupId: string
): Promise<ExistingInsertable[]> {
    const existing = await db
        .select({
            elementId: insertables.elementId,
            insertableId: insertables.id,
            microversionId: insertables.microversionId,
            supportsFasten: insertables.supportsFasten
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId))
        .all();

    if (existing.length === 0) {
        return existing.map((e) => ({ ...e, hasConfiguration: false }));
    }

    const configuredIds = new Set(
        (
            await db
                .select({ id: configurations.id })
                .from(configurations)
                .where(
                    inArray(
                        configurations.id,
                        existing.map((e) => e.insertableId)
                    )
                )
                .all()
        ).map((c) => c.id)
    );

    return existing.map((e) => ({
        ...e,
        hasConfiguration: configuredIds.has(e.insertableId)
    }));
}

/**
 * Matches each document element to an existing insertable, or assigns a fresh
 * insertable id + defaults for new elements. Pure: `newId` is injected so callers
 * (the memoized match-elements step) own id generation.
 */
export function matchElements(
    docInfo: DocumentInfo,
    existing: ExistingInsertable[],
    newId: () => string
): MatchedElement[] {
    const existingByElementId = new Map(existing.map((e) => [e.elementId, e]));
    const sortOrderByElementId = new Map(
        docInfo.orderedElementIds.map((id, i) => [id, i])
    );
    return docInfo.elements.map((element) => {
        const match = existingByElementId.get(element.elementId);
        return {
            element,
            insertableId: match?.insertableId ?? newId(),
            sortOrder: sortOrderByElementId.get(element.elementId) ?? 0,
            isNew: !match,
            storedMicroversionId: match?.microversionId ?? null,
            supportsFasten: match?.supportsFasten ?? false,
            hasConfiguration: match?.hasConfiguration ?? false
        };
    });
}

/** The matched elements that need (re)loading from Onshape. */
export function getInsertablesToReload(
    matched: MatchedElement[],
    forceReload: boolean
): MatchedElement[] {
    if (forceReload) {
        return matched;
    }
    return matched.filter(
        (m) => m.isNew || m.storedMicroversionId !== m.element.microversionId
    );
}

/** Builds one element's `LoadInsertable` data from its match + the group context. */
function toLoadInsertableData(
    matched: MatchedElement,
    ctx: GroupContext
): LoadInsertableData {
    const { element } = matched;
    return {
        insertableId: matched.insertableId,
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
        sortOrder: matched.sortOrder,
        isNew: matched.isNew,
        supportsFasten: matched.supportsFasten,
        hasConfiguration: matched.hasConfiguration
    };
}
