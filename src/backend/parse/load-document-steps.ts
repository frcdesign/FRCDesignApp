import { and, asc, eq, getTableColumns, notInArray, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "../db";
import {
    configurations,
    groups,
    insertables,
    libraries
} from "../../shared/schema";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getContents, getDocument } from "../onshape-api/endpoints/documents";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import { OnshapeApi } from "../onshape-api/onshape-api";
import {
    OnshapeDocumentContents,
    OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/types/documents";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
import {
    ElementType,
    type FastenInfo,
    type LibraryId,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import { parseFastenInfo } from "./insert-and-fasten";
import { parseOnshapeConfiguration } from "./parse-configuration";
import { parseVendors } from "./parse-vendors";
import { checkGroup, checkInsertable } from "./build-checks";

type Db = ReturnType<typeof getDb>;

// ---------------------------------------------------------------------------
// Data-flow types — each element flows DocumentElement → MatchedElement →
// LoadedElement, so every stage's contents are explicit and named.
// ---------------------------------------------------------------------------

/** A part studio / assembly element (tab) from the Onshape document contents. */
export interface DocumentElement {
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
}

/** The pinned version we sync from (output of the fetch-version step). */
export interface VersionInfo {
    instanceId: string;
    versionName: string;
    versionCreatedAt: string;
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
 * A document element matched against the database: it carries either the existing
 * row's values, or — for a new element — a freshly generated insertable id and
 * defaults. Everything downstream reads its id/flags from here.
 */
export interface MatchedElement {
    element: DocumentElement;
    insertableId: string;
    isNew: boolean;
    /** The microversion currently stored in the DB (null for a new element). */
    storedMicroversionId: string | null;
    /** Whether the user enabled insert-and-fasten — gates re-parsing fasten info. */
    supportsFasten: boolean;
    /** Position in the document's ordered element list. */
    sortOrder: number;
}

/** A matched element with everything loaded from Onshape this run. */
export interface LoadedElement {
    matched: MatchedElement;
    fastenInfo: FastenInfo | null;
    /** Recomputed this run: whether fasten info parsed successfully. */
    supportsFasten: boolean;
    vendors: Vendor[];
    configuration: ParameterObj[] | null;
    thumbnailUrls: ThumbnailUrls | null;
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
// Steps — each takes its dependencies explicitly so it can be unit tested.
// ---------------------------------------------------------------------------

/** fetch-version: the latest version of the document. */
export async function fetchVersion(
    api: OnshapeApi,
    documentId: string
): Promise<VersionInfo> {
    const rawVersion = await getLatestVersion(api, { documentId });
    return {
        instanceId: rawVersion.id,
        versionName: rawVersion.name,
        versionCreatedAt: new Date(rawVersion.createdAt).toISOString()
    };
}

/** fetch-contents: document metadata + the valid elements in display order. */
export async function fetchContents(
    api: OnshapeApi,
    instancePath: InstancePath
): Promise<DocumentInfo> {
    const [rawDoc, rawContents] = await Promise.all([
        getDocument(api, instancePath),
        getContents(api, instancePath)
    ]);

    const elements = getValidElements(rawContents);
    const validElementIds = new Set(elements.map((e) => e.elementId));
    const orderedElementIds = getOrderedElementIds(rawContents).filter((id) =>
        validElementIds.has(id)
    );

    return {
        docName: rawDoc.name,
        thumbnailElementId: rawDoc.documentThumbnailElementId,
        elements,
        orderedElementIds
    };
}

/** The existing insertables for a group, by the fields we match on. */
export async function fetchExistingInsertables(
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
            isNew: !match,
            storedMicroversionId: match?.microversionId ?? null,
            supportsFasten: match?.supportsFasten ?? false,
            sortOrder: sortOrderByElementId.get(element.elementId) ?? 0
        };
    });
}

/** The matched elements that need (re)loading from Onshape. */
export function selectReloads(
    matched: MatchedElement[],
    forceReload: boolean
): MatchedElement[] {
    return matched.filter(
        (m) =>
            forceReload ||
            m.isNew ||
            m.storedMicroversionId !== m.element.microversionId
    );
}

/**
 * load-element: fasten info. Only re-parsed when the element supports fasten; the
 * fasten info is JSON-stringified to cross the workflow step boundary.
 */
export async function loadElementFasten(
    api: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    supportsFasten: boolean
): Promise<{ fastenInfo: string | null; supportsFasten: boolean }> {
    if (!supportsFasten) return { fastenInfo: null, supportsFasten: false };
    try {
        const info = await parseFastenInfo(api, elementPath, elementType);
        return { fastenInfo: JSON.stringify(info), supportsFasten: true };
    } catch {
        // Mate connector no longer present.
        return { fastenInfo: null, supportsFasten: false };
    }
}

/** load-configuration: parsed parameters + vendors, or null when unconfigured. */
export async function loadElementConfiguration(
    api: OnshapeApi,
    elementPath: ElementPath,
    name: string
): Promise<{ parameters: ParameterObj[]; vendors: Vendor[] } | null> {
    const rawConfig = await getConfiguration(api, elementPath);
    if (rawConfig.configurationParameters.length === 0) return null;
    const configuration = parseOnshapeConfiguration(rawConfig);
    return {
        parameters: configuration.parameters,
        vendors: parseVendors(name, configuration)
    };
}

// ---------------------------------------------------------------------------
// Pure row builders + the save step.
// ---------------------------------------------------------------------------

interface SaveContext {
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    version: VersionInfo;
}

/** The insertable row for a loaded element. */
export function buildInsertableValues(
    loaded: LoadedElement,
    ctx: SaveContext
): typeof insertables.$inferInsert {
    const { matched } = loaded;
    return {
        id: matched.insertableId,
        elementId: matched.element.elementId,
        groupId: ctx.groupId,
        documentId: ctx.documentId,
        libraryId: ctx.libraryId,
        name: matched.element.name,
        elementType: matched.element.elementType,
        microversionId: matched.element.microversionId,
        instanceId: ctx.version.instanceId,
        versionName: ctx.version.versionName,
        versionCreatedAt: ctx.version.versionCreatedAt,
        sortOrder: matched.sortOrder,
        vendors: loaded.vendors,
        thumbnailUrls: loaded.thumbnailUrls,
        fastenInfo: loaded.fastenInfo,
        supportsFasten: loaded.supportsFasten,
        buildIssues: checkInsertable({
            vendors: loaded.vendors,
            thumbnailUrls: loaded.thumbnailUrls
        })
    };
}

/** The group row for the synced document. */
export function buildGroupValues(ctx: {
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    docInfo: DocumentInfo;
    version: VersionInfo;
    docThumbnailUrls: ThumbnailUrls | null;
}): typeof groups.$inferInsert {
    return {
        id: ctx.groupId,
        documentId: ctx.documentId,
        libraryId: ctx.libraryId,
        name: ctx.docInfo.docName,
        instanceId: ctx.version.instanceId,
        thumbnailUrls: ctx.docThumbnailUrls,
        buildIssues: checkGroup({
            hasThumbnailTab: !!ctx.docInfo.thumbnailElementId,
            thumbnailUrls: ctx.docThumbnailUrls
        })
    };
}

/**
 * When writing a new row that conflicts with an existing one, overwrite every
 * column except the ones in `except`.
 */
export function conflictUpdateSet(
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

/** Inserts the group at the end (or after `selectedGroupId`) if it isn't ordered yet. */
async function updateGroupOrder(
    db: Db,
    libraryId: LibraryId,
    groupId: string,
    selectedGroupId: string | undefined
): Promise<void> {
    const orderedGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.libraryId, libraryId))
        .orderBy(asc(groups.sortOrder))
        .all();
    const currentOrder = orderedGroups.map((g) => g.id);
    if (currentOrder.includes(groupId)) return;

    const insertAfter = selectedGroupId
        ? currentOrder.indexOf(selectedGroupId)
        : -1;
    currentOrder.splice(
        insertAfter !== -1 ? insertAfter + 1 : currentOrder.length,
        0,
        groupId
    );
    await Promise.all(
        currentOrder.map((id, i) =>
            db.update(groups).set({ sortOrder: i }).where(eq(groups.id, id))
        )
    );
}

/**
 * save-to-db: upserts the group and the loaded insertables/configurations and
 * deletes insertables that are no longer valid. Ids come straight off each
 * `LoadedElement.matched`, so there's no id juggling here.
 */
export async function saveDocument(
    db: Db,
    args: {
        groupId: string;
        documentId: string;
        libraryId: LibraryId;
        selectedGroupId: string | undefined;
        version: VersionInfo;
        docInfo: DocumentInfo;
        docThumbnailUrls: ThumbnailUrls | null;
        loaded: LoadedElement[];
    }
): Promise<void> {
    const {
        groupId,
        documentId,
        libraryId,
        selectedGroupId,
        version,
        docInfo,
        docThumbnailUrls,
        loaded
    } = args;
    const ctx: SaveContext = { groupId, documentId, libraryId, version };

    await db.insert(libraries).values({ id: libraryId }).onConflictDoNothing();

    await updateGroupOrder(db, libraryId, groupId, selectedGroupId);

    const validElementIds = docInfo.elements.map((e) => e.elementId);

    const groupUpsert = db
        .insert(groups)
        .values(buildGroupValues({ ...ctx, docInfo, docThumbnailUrls }))
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
            .values(buildInsertableValues(l, ctx))
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
        .filter((l) => l.configuration !== null)
        .map((l) =>
            db
                .insert(configurations)
                .values({
                    id: l.matched.insertableId,
                    parameters: l.configuration!
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
            : db.delete(insertables).where(eq(insertables.groupId, groupId));

    // Stale configurations cascade-delete with their insertable.
    await db.batch([
        groupUpsert,
        ...insertableUpserts,
        ...configUpserts,
        deleteStaleInsertables
    ]);
}
