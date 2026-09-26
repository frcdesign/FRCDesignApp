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
import { type SearchRecord } from "../configurations/contract";
import { buildSearchDb } from "../search/build";
import { searchRecordsOf } from "../search/records";

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
        // Ids only; the payload is fetched when one is opened.
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
        // A shell group has no version, so link to the document instead.
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

/** Returns the new slot; the caller writes the row. */
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

/** Called wherever a library id is written. */
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

/** Versioned by shape: an older index is ignored and the route rebuilds it. */
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
        getSearchRecords(db, libraryId)
    ]);
    const searchDb = JSON.stringify(buildSearchDb(libraryData, indexed));
    // Uncompressed, since the runtime compresses responses itself.
    await bucket.put(searchIndexKey(libraryId), searchDb, {
        httpMetadata: { contentType: "application/json" }
    });
    return searchDb;
}

async function getSearchRecords(
    db: Db,
    libraryId: LibraryId
): Promise<Record<string, SearchRecord[]>> {
    const rows = await db
        .select({
            id: insertables.id,
            partMetadata: insertables.partMetadata,
            vendors: insertables.vendors,
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

    return Object.fromEntries(
        rows.map((row) => [row.id, searchRecordsOf(row)])
    );
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
