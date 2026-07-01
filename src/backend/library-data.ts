import { asc, eq, sql } from "drizzle-orm";
import { type Db } from "./db";
import {
    libraries,
    groups,
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
                instanceId: group.instanceId,
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
            instanceId: ins.instanceId,
            path: {
                documentId: ins.documentId,
                instanceId: ins.instanceId,
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
 * Creates a new group row and places it in the library's sort order — directly after
 * `selectedGroupId` if given, otherwise at the end. Ensures the library row exists.
 */
export async function createOrderedGroup(
    db: Db,
    args: {
        groupId: string;
        libraryId: LibraryId;
        documentId: string;
        name: string;
        instanceId: string;
        selectedGroupId: string | undefined;
    }
): Promise<void> {
    const {
        groupId,
        libraryId,
        documentId,
        name,
        instanceId,
        selectedGroupId
    } = args;

    await db.insert(libraries).values({ id: libraryId }).onConflictDoNothing();

    const orderedGroups = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.libraryId, libraryId))
        .orderBy(asc(groups.sortOrder))
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

    await db.insert(groups).values({
        id: groupId,
        documentId,
        libraryId,
        name,
        instanceId,
        sortOrder: currentOrder.indexOf(groupId)
    });
    await Promise.all(
        currentOrder
            .map((id, i) => [id, i] as const)
            .filter(([id]) => id !== groupId)
            .map(([id, i]) =>
                db.update(groups).set({ sortOrder: i }).where(eq(groups.id, id))
            )
    );
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
    const libraryData = await getLibraryOut(db, libraryId);
    const searchDb = JSON.stringify(buildSearchDb(libraryData));
    await db
        .insert(libraries)
        .values({ id: libraryId, searchDb })
        .onConflictDoUpdate({ target: libraries.id, set: { searchDb } });
    return searchDb;
}
