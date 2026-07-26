import { asc, eq, sql } from "drizzle-orm";
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
import { PartNumberMap } from "../shared/configuration-models";
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
        db.select({ id: configurations.id }).from(configurations).all()
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
            thumbnailUrls: group.thumbnailUrls!,
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
            thumbnailUrls: ins.thumbnailUrls!,
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
 * Places a not-yet-created group in the library's sort order — directly after
 * `selectedGroupId` if given, otherwise at the end — by renumbering the existing
 * siblings, and returns the sort order the new group itself should be written with.
 * Doesn't write the new group's row; the caller (the load-group workflow) does that,
 * since it also decides whether this is a create or an update.
 */
export async function placeNewGroup(
    db: Db,
    libraryId: LibraryId,
    groupId: string,
    selectedGroupId: string | undefined
): Promise<number> {
    const orderedGroups = await db
        .select({ id: group.id })
        .from(group)
        .where(eq(group.libraryId, libraryId))
        .orderBy(asc(group.sortOrder))
        .all();
    const currentOrder = orderedGroups.map((g) => g.id);
    const insertAfter = selectedGroupId
        ? currentOrder.indexOf(selectedGroupId)
        : -1;
    currentOrder.splice(
        insertAfter !== -1 ? insertAfter + 1 : currentOrder.length,
        0,
        groupId
    );

    await Promise.all(
        currentOrder
            .map((id, i) => [id, i] as const)
            .filter(([id]) => id !== groupId)
            .map(([id, i]) =>
                db.update(group).set({ sortOrder: i }).where(eq(group.id, id))
            )
    );

    return currentOrder.indexOf(groupId);
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

/**
 * Rebuilds the serialized MiniSearch index for a library from its current
 * groups/insertables and stores it on the `libraries` row in D1.
 */
export async function rebuildSearchDb(
    db: Db,
    libraryId: LibraryId
): Promise<string> {
    const [libraryData, partNumberMap] = await Promise.all([
        getLibraryOut(db, libraryId),
        getPartNumberMap(db, libraryId)
    ]);
    const searchDb = JSON.stringify(buildSearchDb(libraryData, partNumberMap));
    await db
        .insert(libraries)
        .values({ id: libraryId, searchDb })
        .onConflictDoUpdate({ target: libraries.id, set: { searchDb } });
    return searchDb;
}

/**
 * Assembles the per-insertable part-number map used to index part numbers:
 * a configurable insertable's map comes from its `configurations` row, while a
 * non-configurable one contributes its single `defaultPartNumber`.
 */
async function getPartNumberMap(
    db: Db,
    libraryId: LibraryId
): Promise<Record<string, PartNumberMap>> {
    const rows = await db
        .select({
            id: insertables.id,
            defaultPartNumber: insertables.defaultPartNumber,
            partNumbers: configurations.partNumbers
        })
        .from(insertables)
        .leftJoin(configurations, eq(configurations.id, insertables.id))
        .where(eq(insertables.libraryId, libraryId))
        .all();

    const partNumberMap: Record<string, PartNumberMap> = {};
    for (const row of rows) {
        if (row.partNumbers && Object.keys(row.partNumbers).length > 0) {
            partNumberMap[row.id] = row.partNumbers;
        } else if (row.defaultPartNumber) {
            partNumberMap[row.id] = { [row.defaultPartNumber]: {} };
        }
    }
    return partNumberMap;
}
