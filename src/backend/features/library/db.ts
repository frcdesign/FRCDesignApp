import { asc, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { increment } from "../../db/updates";
import {
    libraries,
    groups,
    insertables,
    configurations,
    PLACEHOLDER_VERSION_ID
} from "../../db/schema";
import { LibraryId } from "./library-id";
import { InsertableOut, LibraryOut, Insertables, Groups } from "./contract";
import { toRecords } from "../configurations/utils";
import { buildSearchDb, type IndexedConfiguration } from "../search/build";

/**
 * Assembles the full `LibraryOut` (groups + insertables, in sort order) for a
 * library from D1.
 */
export async function getLibraryOut(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryOut> {
    const allGroups = await db
        .select()
        .from(groups)
        .where(eq(groups.libraryId, libraryId))
        .orderBy(asc(groups.sortOrder))
        .all();

    if (allGroups.length === 0) {
        return { groupOrder: [], groups: {}, insertables: {} };
    }

    const groupOrder = allGroups.map((g) => g.id);

    const [allInsertables, allConfigurations] = await Promise.all([
        db
            .select()
            .from(insertables)
            .where(eq(insertables.libraryId, libraryId))
            .orderBy(asc(insertables.sortOrder))
            .all(),
        // Ids only: a configurations row exists exactly when there are
        // parameters, and its payload is fetched when one is opened.
        db
            .select({ insertableId: configurations.insertableId })
            .from(configurations)
            .innerJoin(
                insertables,
                eq(configurations.insertableId, insertables.id)
            )
            .where(eq(insertables.libraryId, libraryId))
            .all()
    ]);

    const configurableIds = new Set(
        allConfigurations.map((row) => row.insertableId)
    );

    const groupsOut: Groups = {};
    for (const group of allGroups) {
        const groupInsertables = allInsertables.filter(
            (ins) => ins.groupId === group.id
        );
        if (group.sortAlphabetically) {
            groupInsertables.sort((a, b) => a.name.localeCompare(b.name));
        }
        const insertableOrder = groupInsertables.map((ins) => ins.id);
        // A shell group has no version to link to, so its path stops at the
        // document rather than pointing at a `/v/placeholder` that 404s.
        const hasVersion = group.versionId !== PLACEHOLDER_VERSION_ID;
        groupsOut[group.id] = {
            id: group.id,
            documentId: group.documentId,
            path: hasVersion
                ? {
                      documentId: group.documentId,
                      instanceId: group.versionId,
                      instanceType: "v"
                  }
                : { documentId: group.documentId },
            name: group.name,
            smallThumbnailUrl: group.smallThumbnailUrl ?? undefined,
            largeThumbnailUrl: group.largeThumbnailUrl ?? undefined,
            isLoaded: group.lastLoadedAt !== null,
            insertableOrder
        };
    }

    const insertablesOut: Insertables = {};
    for (const ins of allInsertables) {
        insertablesOut[ins.id] = {
            id: ins.id,
            elementId: ins.elementId,
            groupId: ins.groupId,
            documentId: ins.documentId,
            versionId: ins.versionId,
            path: {
                documentId: ins.documentId,
                instanceId: ins.versionId,
                instanceType: "v",
                elementId: ins.elementId
            },
            name: ins.name,
            microversionId: ins.microversionId,
            isVisible: ins.isVisible,
            supportsFasten: ins.supportsFasten,
            elementType: ins.elementType,
            smallThumbnailUrl: ins.smallThumbnailUrl ?? undefined,
            largeThumbnailUrl: ins.largeThumbnailUrl ?? undefined,
            isConfigurable: configurableIds.has(ins.id),
            vendors: ins.vendors
        } satisfies InsertableOut;
    }

    return {
        groupOrder,
        groups: groupsOut,
        insertables: insertablesOut
    };
}

/**
 * Renumbers a library's groups to open a slot and returns its sort order. The
 * caller writes the row, since it also decides create vs. update.
 */
export async function placeNewGroup(
    db: Db,
    libraryId: LibraryId,
    selectedGroupId: string | undefined
): Promise<number> {
    const siblings = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.libraryId, libraryId))
        .orderBy(asc(groups.sortOrder))
        .all();

    const selectedIndex = selectedGroupId
        ? siblings.findIndex((sibling) => sibling.id === selectedGroupId)
        : -1;
    // An unknown or unspecified selection puts the new group last.
    const newIndex = selectedIndex === -1 ? siblings.length : selectedIndex + 1;

    // Renumber every sibling to close any gaps: those at or past the new slot
    // shift up by one to make room for it.
    await Promise.all(
        siblings.map((sibling, index) =>
            db
                .update(groups)
                .set({ sortOrder: index < newIndex ? index : index + 1 })
                .where(eq(groups.id, sibling.id))
        )
    );

    return newIndex;
}

/**
 * The row everything pointing at a library needs first. Called wherever a library
 * id is written: a library gets its row on the first group added to it.
 */
export async function ensureLibrary(
    db: Db,
    libraryId: LibraryId
): Promise<void> {
    await db.insert(libraries).values({ id: libraryId }).onConflictDoNothing();
}

export async function bumpLibraryVersion(
    db: Db,
    libraryId: LibraryId
): Promise<void> {
    await db
        .insert(libraries)
        .values({ id: libraryId, cacheVersion: 1 })
        .onConflictDoUpdate({
            target: libraries.id,
            set: { cacheVersion: increment(libraries.cacheVersion) }
        });
}

/**
 * The R2 object key holding a library's serialized MiniSearch index. Versioned
 * by the shape of what it stores: an index written in an older shape is left
 * behind rather than read, and the route rebuilds a missing one.
 */
export function searchIndexKey(libraryId: LibraryId): string {
    return `search-index/v2/${libraryId}.json`;
}

/** Rebuilds a library's search index into R2; bump `cacheVersion` alongside. */
export async function rebuildSearchDb(
    bucket: R2Bucket,
    db: Db,
    libraryId: LibraryId
): Promise<string> {
    const [libraryData, indexed] = await Promise.all([
        getLibraryOut(db, libraryId),
        getIndexedConfigurations(db, libraryId)
    ]);
    const searchDb = JSON.stringify(buildSearchDb(libraryData, indexed));
    // Uncompressed: encoding here would leave the runtime compressing an
    // already-compressed body.
    await bucket.put(searchIndexKey(libraryId), searchDb, {
        httpMetadata: { contentType: "application/json" }
    });
    return searchDb;
}

/**
 * What `buildSearchDb` indexes: an element's own part data plus one record per
 * indexed configuration, and the parameters those are read against. Left
 * joined — an unconfigurable element has no row.
 */
async function getIndexedConfigurations(
    db: Db,
    libraryId: LibraryId
): Promise<Record<string, IndexedConfiguration>> {
    const rows = await db
        .select({
            id: insertables.id,
            partMetadata: insertables.partMetadata,
            parameters: configurations.parameters,
            records: configurations.records
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(eq(insertables.libraryId, libraryId))
        .all();

    const indexed: Record<string, IndexedConfiguration> = {};
    for (const row of rows) {
        const records = toRecords(row.partMetadata, row.records ?? []);
        if (records.length > 0) {
            indexed[row.id] = { parameters: row.parameters ?? [], records };
        }
    }
    return indexed;
}

/** The library an insertable is in, for a route that names only the insertable. */
export async function libraryOfInsertable(
    db: Db,
    insertableId: string
): Promise<LibraryId | undefined> {
    const row = await db
        .select({ libraryId: insertables.libraryId })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();
    return row?.libraryId;
}

/** The library a group is in, for a route that names only the group. */
export async function libraryOfGroup(
    db: Db,
    groupId: string
): Promise<LibraryId | undefined> {
    const row = await db
        .select({ libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.id, groupId))
        .get();
    return row?.libraryId;
}
