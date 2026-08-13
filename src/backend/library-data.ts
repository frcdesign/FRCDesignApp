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
            thumbnailUrls: group.thumbnailUrls ?? undefined,
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
            thumbnailUrls: ins.thumbnailUrls ?? undefined,
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
 * Renumbers a library's groups to open a slot for a new group — directly after
 * `selectedGroupId`, or at the end — and returns the sort order to write it with.
 * The caller creates the row itself, since it also decides create vs. update.
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
