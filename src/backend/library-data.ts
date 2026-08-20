import { and, asc, eq, sql } from "drizzle-orm";
import { type Db } from "./db";
import {
    libraries,
    group,
    insertables,
    configurations
} from "../shared/schema";
import { LibraryId } from "../shared/types";
import {
    InsertableOut,
    LibraryOut,
    Insertables,
    Groups
} from "../shared/api-models";
import { ConfigurationRecord } from "../shared/configuration-models";
import { buildSearchDb } from "../shared/search";

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
        .from(group)
        .where(eq(group.libraryId, libraryId))
        .orderBy(asc(group.sortOrder))
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
        // A row can exist just to hold records, so "configurable" keys on
        // having parameters. Tested in SQL to leave the payload in D1.
        db
            .select({ id: configurations.id })
            .from(configurations)
            .innerJoin(insertables, eq(configurations.id, insertables.id))
            .where(
                and(
                    eq(insertables.libraryId, libraryId),
                    sql`json_array_length(${configurations.parameters}) > 0`
                )
            )
            .all()
    ]);

    const configSet = new Set(allConfigurations.map((c) => c.id));

    const groupsOut: Groups = {};
    for (const group of allGroups) {
        const groupInsertables = allInsertables.filter(
            (ins) => ins.groupId === group.id
        );
        if (group.sortAlphabetically) {
            groupInsertables.sort((a, b) => a.name.localeCompare(b.name));
        }
        const insertableOrder = groupInsertables.map((ins) => ins.id);
        groupsOut[group.id] = {
            id: group.id,
            documentId: group.documentId,
            path: {
                documentId: group.documentId,
                instanceId: group.versionId,
                instanceType: "v"
            },
            name: group.name,
            smallThumbnailUrl: group.smallThumbnailUrl ?? undefined,
            largeThumbnailUrl: group.largeThumbnailUrl ?? undefined,
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
            configurationId: configSet.has(ins.id) ? ins.id : undefined,
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
        .select({ id: group.id })
        .from(group)
        .where(eq(group.libraryId, libraryId))
        .orderBy(asc(group.sortOrder))
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
                .update(group)
                .set({ sortOrder: index < newIndex ? index : index + 1 })
                .where(eq(group.id, sibling.id))
        )
    );

    return newIndex;
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
            set: { cacheVersion: sql`cache_version + 1` }
        });
}

/** The R2 object key holding a library's serialized MiniSearch index. */
export function searchIndexKey(libraryId: LibraryId): string {
    return `search-index/${libraryId}.json`;
}

/** Rebuilds a library's search index into R2; bump `cacheVersion` alongside. */
export async function rebuildSearchDb(
    bucket: R2Bucket,
    db: Db,
    libraryId: LibraryId
): Promise<string> {
    const start = Date.now();
    const [libraryData, recordsMap] = await Promise.all([
        getLibraryOut(db, libraryId),
        getRecordsMap(db, libraryId)
    ]);
    const searchDb = JSON.stringify(buildSearchDb(libraryData, recordsMap));
    // Uncompressed: encoding here would leave the runtime compressing an
    // already-compressed body.
    await bucket.put(searchIndexKey(libraryId), searchDb, {
        httpMetadata: { contentType: "application/json" }
    });
    console.log(
        `Rebuilt search index for ${libraryId}: ` +
            `${searchDb.length} B, ${Date.now() - start} ms`
    );
    return searchDb;
}

/**
 * Assembles the per-insertable configuration records `buildSearchDb` dedupes into
 * the part-number search map. Only indexed insertables have records.
 */
async function getRecordsMap(
    db: Db,
    libraryId: LibraryId
): Promise<Record<string, ConfigurationRecord[]>> {
    const rows = await db
        .select({
            id: insertables.id,
            records: configurations.records
        })
        .from(insertables)
        .innerJoin(configurations, eq(configurations.id, insertables.id))
        .where(eq(insertables.libraryId, libraryId))
        .all();

    const recordsMap: Record<string, ConfigurationRecord[]> = {};
    for (const row of rows) {
        if (row.records.length > 0) {
            recordsMap[row.id] = row.records;
        }
    }
    return recordsMap;
}
