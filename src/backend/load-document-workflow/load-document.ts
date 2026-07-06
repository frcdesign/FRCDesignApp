import {
    WorkflowEntrypoint,
    WorkflowEvent,
    WorkflowStep
} from "cloudflare:workers";
import { and, eq, getTableColumns, notInArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { Db, getDb } from "../db";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
import {
    ElementType,
    type FastenInfo,
    type LibraryId,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import {
    configurations,
    groups,
    insertables,
    libraries
} from "../../shared/schema";
import {
    uploadThumbnails,
    uploadDocumentThumbnails
} from "../routes/thumbnails";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import { getVersion } from "../onshape-api/endpoints/versions";
import { getContents, getDocument } from "../onshape-api/endpoints/documents";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { OnshapeApi } from "../onshape-api/onshape-api";
import {
    OnshapeDocumentContents,
    OnshapeFolderEntry,
    OnshapeFolderEntryType,
    OnshapeVersionInfo
} from "../onshape-api/onshape-types";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { checkGroup, checkInsertable } from "../parse/build-checks";
import { parseFastenInfo } from "../parse/insert-and-fasten";

// ---------------------------------------------------------------------------
// Data-flow types — each element flows DocumentElement → MatchedElement → the
// insertable row, so every stage's contents are explicit and named.
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
}

/**
 * A document element matched against the database. It carries only the fields the
 * match phase decides — the existing insertable id (or a fresh one for a new element),
 * its position, and the reload/fasten metadata. Everything else on the saved row is
 * rederived at load time (see `toInsertableRow`), so nothing is stored twice.
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
}

/** The Onshape-loaded fields of an insertable, filled in by the load step. */
interface LoadedFields {
    vendors: Vendor[];
    thumbnailUrls: ThumbnailUrls | null;
    fastenInfo: FastenInfo | null;
}

/** The shared context every saved row needs but that isn't part of the element itself. */
interface LoadContext {
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    version: OnshapeVersionInfo;
}

export interface LoadDocumentParams {
    /** The group to sync — must already exist (see `createOrderedGroup`). */
    groupId: string;
    sessionId: string;
    forceReload?: boolean;
}

/**
 * Syncs an Onshape document into the library database.
 *
 * `run()` is a thin orchestrator: it sequences the workflow steps, each of which is a
 * method that resolves its dependencies (the Onshape client / D1) and delegates the
 * testable, deterministic logic to the pure free functions defined below.
 */
export class LoadDocumentWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadDocumentParams
> {
    async run(
        event: WorkflowEvent<LoadDocumentParams>,
        step: WorkflowStep
    ): Promise<void> {
        const { groupId, sessionId, forceReload = false } = event.payload;

        // Look up the group's document/library (the caller already created the row).
        const { documentId, libraryId } = await step.do("load-group", () =>
            this.loadGroup(groupId)
        );

        const version = await step.do("fetch-version", () =>
            this.fetchVersion(sessionId, documentId)
        );

        const instancePath: InstancePath = {
            documentId,
            instanceId: version.id,
            instanceType: "v"
        };
        const ctx: LoadContext = { groupId, documentId, libraryId, version };

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
        const docThumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `doc-thumbnail-${documentId}`,
            async () =>
                uploadDocumentThumbnails(
                    this.env.THUMBNAILS,
                    await this.api(sessionId),
                    instancePath
                )
        );

        // Load the elements that need reloading — new elements skip the fasten step.
        const loaded = await Promise.all(
            getInsertablesToReload(matched, forceReload).map((m) =>
                m.isNew
                    ? this.loadNewElement(step, sessionId, instancePath, m, ctx)
                    : this.reloadElement(step, sessionId, instancePath, m, ctx)
            )
        );

        // Persist everything.
        await step.do("save-to-db", () =>
            this.saveDocument(ctx, docInfo, docThumbnailUrls, loaded)
        );

        // Rebuild the library's search index and bump the cache version.
        await step.do("rebuild-search-db", () => this.rebuildSearch(libraryId));
    }

    /** Resolves the Onshape client for a session (fresh per step, for replay-safety). */
    private api(sessionId: string): Promise<OnshapeApi> {
        return getOnshapeApiForSessionId(this.env.KV, sessionId);
    }

    private loadGroup(groupId: string) {
        return fetchGroup(getDb(this.env.DB), groupId);
    }

    /** The document version to sync to (its most recently created version). */
    private async fetchVersion(
        sessionId: string,
        documentId: string
    ): Promise<OnshapeVersionInfo> {
        const api = await this.api(sessionId);
        const doc = await getDocument(api, { documentId });
        return getVersion(api, {
            documentId,
            instanceId: doc.recentVersion.id,
            instanceType: "v"
        });
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
     * Loads the fields shared by new and reloaded elements: configuration (parameters
     * + vendors) and thumbnails. Vendors keep name-over-configuration precedence.
     */
    private async loadElementContent(
        step: WorkflowStep,
        sessionId: string,
        elementPath: ElementPath,
        name: string,
        microversionId: string
    ): Promise<{
        vendors: Vendor[];
        parameters: ParameterObj[] | null;
        thumbnailUrls: ThumbnailUrls | null;
    }> {
        const config = await step.do(
            `load-configuration-${elementPath.elementId}`,
            async () =>
                loadElementConfiguration(await this.api(sessionId), elementPath)
        );

        const thumbnailUrls = await this.uploadThumbnailsWithRetry(
            step,
            `element-thumbnail-${elementPath.elementId}`,
            async () =>
                uploadThumbnails(
                    this.env.THUMBNAILS,
                    await this.api(sessionId),
                    elementPath,
                    microversionId
                )
        );

        return {
            vendors: parseVendors(name, config ?? undefined),
            parameters: config?.parameters ?? null,
            thumbnailUrls
        };
    }

    /**
     * A brand-new insertable: it has no stored fasten preference, so fasten never
     * parses (skipped) and the row's other flags fall back to their column defaults.
     */
    private async loadNewElement(
        step: WorkflowStep,
        sessionId: string,
        instancePath: InstancePath,
        matched: MatchedElement,
        ctx: LoadContext
    ): Promise<{
        insertable: typeof insertables.$inferInsert;
        parameters: ParameterObj[] | null;
    }> {
        const { element } = matched;
        const elementPath: ElementPath = {
            ...instancePath,
            elementId: element.elementId
        };
        const content = await this.loadElementContent(
            step,
            sessionId,
            elementPath,
            element.name,
            element.microversionId
        );
        return {
            insertable: toInsertableRow(matched, ctx, {
                ...content,
                fastenInfo: null
            }),
            parameters: content.parameters
        };
    }

    /**
     * An existing insertable whose version changed (or a forced reload): reloads the
     * shared content and, only when the user enabled insert-and-fasten, re-parses
     * fasten info (which may now disable it if the mate connector is gone).
     */
    private async reloadElement(
        step: WorkflowStep,
        sessionId: string,
        instancePath: InstancePath,
        matched: MatchedElement,
        ctx: LoadContext
    ): Promise<{
        insertable: typeof insertables.$inferInsert;
        parameters: ParameterObj[] | null;
    }> {
        const { element } = matched;
        const elementPath: ElementPath = {
            ...instancePath,
            elementId: element.elementId
        };
        const content = await this.loadElementContent(
            step,
            sessionId,
            elementPath,
            element.name,
            element.microversionId
        );

        let fastenInfo = null;
        if (matched.supportsFasten) {
            fastenInfo = await step.do(
                `load-element-${element.elementId}`,
                async () =>
                    parseFastenInfo(
                        await this.api(sessionId),
                        elementPath,
                        element.elementType
                    )
            );
        }

        return {
            insertable: toInsertableRow(matched, ctx, {
                ...content,
                fastenInfo
            }),
            parameters: content.parameters
        };
    }

    /**
     * Upserts the group and the loaded insertables/configurations and deletes
     * insertables that are no longer valid. Ids come straight off each loaded row, so
     * there's no id juggling here. The group's identity and its position in the
     * library's sort order are owned by the caller (see `createOrderedGroup` in
     * `../library-data`) — this only updates its synced fields.
     */
    private async saveDocument(
        ctx: LoadContext,
        docInfo: DocumentInfo,
        docThumbnailUrls: ThumbnailUrls | null,
        loaded: {
            insertable: typeof insertables.$inferInsert;
            parameters: ParameterObj[] | null;
        }[]
    ): Promise<void> {
        const { groupId, documentId, libraryId, version } = ctx;
        const db = getDb(this.env.DB);

        await db
            .insert(libraries)
            .values({ id: libraryId })
            .onConflictDoNothing();

        const validElementIds = docInfo.elements.map((e) => e.elementId);

        const groupRow: typeof groups.$inferInsert = {
            id: groupId,
            documentId,
            libraryId,
            name: docInfo.docName,
            instanceId: version.id,
            thumbnailUrls: docThumbnailUrls,
            buildIssues: checkGroup({
                hasThumbnailTab: !!docInfo.thumbnailElementId,
                thumbnailUrls: docThumbnailUrls
            })
        };

        const groupUpsert = db
            .insert(groups)
            .values(groupRow)
            .onConflictDoUpdate({
                target: [groups.documentId, groups.libraryId],
                set: conflictUpdateSet(groups, [
                    "id",
                    "documentId",
                    "libraryId",
                    "sortAlphabetically",
                    "sortOrder"
                ])
            });

        const insertableUpserts = loaded.map((l) =>
            db
                .insert(insertables)
                .values(l.insertable)
                .onConflictDoUpdate({
                    target: [insertables.elementId, insertables.groupId],
                    set: conflictUpdateSet(insertables, [
                        "id",
                        "elementId",
                        "groupId",
                        "documentId",
                        "libraryId",
                        "isVisible",
                        "isOpenComposite",
                        "sortOrder"
                    ])
                })
        );

        const configUpserts = loaded
            .filter((loaded) => loaded.parameters !== null)
            .map((loaded) =>
                db
                    .insert(configurations)
                    .values({
                        id: loaded.insertable.id!,
                        parameters: loaded.parameters!
                    })
                    .onConflictDoUpdate({
                        target: configurations.id,
                        set: conflictUpdateSet(configurations, ["id"])
                    })
            );

        const deleteStaleInsertables =
            validElementIds.length > 0
                ? db
                      .delete(insertables)
                      .where(
                          and(
                              eq(insertables.groupId, groupId),
                              notInArray(insertables.elementId, validElementIds)
                          )
                      )
                : db
                      .delete(insertables)
                      .where(eq(insertables.groupId, groupId));

        // Stale configurations cascade-delete with their insertable.
        await db.batch([
            groupUpsert,
            ...insertableUpserts,
            ...configUpserts,
            deleteStaleInsertables
        ]);
    }

    private async rebuildSearch(libraryId: LibraryId): Promise<void> {
        const db = getDb(this.env.DB);
        await rebuildSearchDb(db, libraryId);
        await bumpLibraryVersion(db, libraryId);
    }

    /**
     * Uploads thumbnails with a manual retry schedule: two quick attempts, then two
     * spaced ones (Onshape renders thumbnails asynchronously, so a fresh version's
     * images may not exist yet). Shared by the document-level and per-element uploads.
     * Each attempt is its own `step.do` with retries disabled so the sleeps between
     * them are the only backoff.
     */
    private async uploadThumbnailsWithRetry(
        step: WorkflowStep,
        prefix: string,
        uploadFn: () => Promise<ThumbnailUrls | null>
    ): Promise<ThumbnailUrls | null> {
        const tryUpload = (n: number) =>
            step.do(
                `${prefix}-${n}`,
                { retries: { limit: 0, delay: 0, backoff: "constant" } },
                uploadFn
            );

        let thumbnails = await tryUpload(1);
        if (thumbnails) return thumbnails;
        await step.sleep(`${prefix}-wait-1`, "5 seconds");
        thumbnails = await tryUpload(2);
        if (thumbnails) return thumbnails;

        await step.sleep(`${prefix}-wait-2`, "5 minutes");
        thumbnails = await tryUpload(3);
        if (thumbnails) return thumbnails;

        await step.sleep(`${prefix}-wait-3`, "5 minutes");
        return await tryUpload(4);
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

/** The group's document/library. Reads a row the caller must have already created. */
async function fetchGroup(db: Db, groupId: string) {
    const group = await db
        .select({ documentId: groups.documentId, libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.id, groupId))
        .get();
    if (!group) {
        throw new Error(`Group ${groupId} not found`);
    }
    return group;
}

/** The existing insertables for a group, by the fields we match on. */
async function fetchExistingInsertables(
    db: Db,
    groupId: string
): Promise<ExistingInsertable[]> {
    return db
        .select({
            elementId: insertables.elementId,
            insertableId: insertables.id,
            microversionId: insertables.microversionId,
            supportsFasten: insertables.supportsFasten
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId))
        .all();
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
            supportsFasten: match?.supportsFasten ?? false
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

/** Parsed configuration parameters, or null when the element is unconfigured. */
async function loadElementConfiguration(
    api: OnshapeApi,
    elementPath: ElementPath
): Promise<{ parameters: ParameterObj[] } | null> {
    const rawConfig = await getConfiguration(api, elementPath);
    if (rawConfig.configurationParameters.length === 0) return null;
    return { parameters: parseOnshapeConfiguration(rawConfig).parameters };
}

// ---------------------------------------------------------------------------
// Pure row assembly + upsert helper.
// ---------------------------------------------------------------------------

/** Assembles the saved insertable row from the matched element, context, and load. */
export function toInsertableRow(
    matched: MatchedElement,
    ctx: LoadContext,
    loaded: LoadedFields
): typeof insertables.$inferInsert {
    const { element } = matched;
    return {
        id: matched.insertableId,
        // Onshape Ids
        documentId: ctx.documentId,
        instanceId: ctx.version.id,
        elementId: element.elementId,
        // Owner Ids
        groupId: ctx.groupId,
        libraryId: ctx.libraryId,
        // Element fields
        name: element.name,
        elementType: element.elementType,
        microversionId: element.microversionId,
        // Version fields
        versionName: ctx.version.name,
        versionCreatedAt: new Date(ctx.version.createdAt).toISOString(),
        // Saved fields
        sortOrder: matched.sortOrder,
        supportsFasten: matched.supportsFasten,
        // Computed fields
        vendors: loaded.vendors,
        thumbnailUrls: loaded.thumbnailUrls,
        fastenInfo: loaded.fastenInfo,
        buildIssues: checkInsertable({
            vendors: loaded.vendors,
            thumbnailUrls: loaded.thumbnailUrls
        })
    };
}

/**
 * When writing a new row that conflicts with an existing one, overwrite every
 * column except the ones in `except`.
 */
function conflictUpdateSet(
    table: SQLiteTable,
    except: string[]
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(getTableColumns(table))
            .filter(([key]) => !except.includes(key))
            .map(([key, col]) => [
                key,
                sql`excluded.${sql.identifier(col.name)}`
            ])
    );
}
