import { type Db } from "../backend/db";
import {
    configurations,
    favorites,
    groups,
    insertables,
    libraries,
    users
} from "../shared/schema";
import { ElementType, LibraryId } from "../shared/types";

/**
 * Truncates every table these helpers touch, in FK-safe order.
 *
 * `@cloudflare/vitest-pool-workers` isolates D1 storage per test *file*, not per
 * test, and there is no built-in per-test reset (`reset()` from `cloudflare:test`
 * only clears Durable Objects). Call this in `beforeEach` to isolate tests that
 * share a database.
 */
export async function resetDb(db: Db): Promise<void> {
    await db.delete(favorites);
    await db.delete(configurations);
    await db.delete(insertables);
    await db.delete(groups);
    await db.delete(users);
    await db.delete(libraries);
}

export async function seedLibrary(
    db: Db,
    id: LibraryId | string = LibraryId.FRC_DESIGN_LIB
): Promise<string> {
    await db.insert(libraries).values({ id }).onConflictDoNothing();
    return id;
}

export async function seedUser(db: Db, id: string): Promise<string> {
    await db.insert(users).values({ id }).onConflictDoNothing();
    return id;
}

export interface SeedGroupOptions {
    id?: string;
    libraryId?: LibraryId | string;
    name?: string;
    documentId?: string;
    instanceId?: string;
}

export async function seedGroup(
    db: Db,
    options: SeedGroupOptions = {}
): Promise<string> {
    const id = options.id ?? crypto.randomUUID();
    await db
        .insert(groups)
        .values({
            id,
            libraryId: options.libraryId ?? LibraryId.FRC_DESIGN_LIB,
            name: options.name ?? "Test Group",
            // Unique per group so repeated fixtures don't collide on the
            // (document_id, library_id) unique index.
            documentId: options.documentId ?? `doc-${id}`,
            instanceId: options.instanceId ?? "inst-1"
        })
        .onConflictDoNothing();
    return id;
}

export interface SeedInsertableOptions {
    id?: string;
    groupId: string;
    libraryId?: LibraryId | string;
    elementId?: string;
    documentId?: string;
    name?: string;
    elementType?: ElementType;
    microversionId?: string;
    versionName?: string;
    versionCreatedAt?: string;
    instanceId?: string;
}

export async function seedInsertable(
    db: Db,
    options: SeedInsertableOptions
): Promise<string> {
    const id = options.id ?? crypto.randomUUID();
    await db
        .insert(insertables)
        .values({
            id,
            groupId: options.groupId,
            libraryId: options.libraryId ?? LibraryId.FRC_DESIGN_LIB,
            elementId: options.elementId ?? `el-${id}`,
            documentId: options.documentId ?? "doc-1",
            name: options.name ?? "Test Insertable",
            elementType: options.elementType ?? ElementType.PART_STUDIO,
            microversionId: options.microversionId ?? "mv-1",
            versionName: options.versionName ?? "v1",
            versionCreatedAt:
                options.versionCreatedAt ?? new Date(0).toISOString(),
            instanceId: options.instanceId ?? "inst-1"
        })
        .onConflictDoNothing();
    return id;
}

export interface SeedFavoriteOptions {
    favoriteId?: string;
    userId: string;
    libraryId?: LibraryId | string;
    insertableId: string;
    sortOrder?: number;
}

export async function seedFavorite(
    db: Db,
    options: SeedFavoriteOptions
): Promise<string> {
    const id = options.favoriteId ?? crypto.randomUUID();
    await db
        .insert(favorites)
        .values({
            id,
            userId: options.userId,
            libraryId: options.libraryId ?? LibraryId.FRC_DESIGN_LIB,
            insertableId: options.insertableId,
            sortOrder: options.sortOrder ?? 0
        })
        .onConflictDoNothing();
    return id;
}

export interface SeedFavoriteFixtureOptions {
    userId: string;
    libraryId?: LibraryId | string;
    insertableId?: string;
    favoriteId?: string;
    sortOrder?: number;
}

/**
 * Seeds the full foreign-key chain (library → group → insertable → user →
 * favorite) and returns the created ids.
 */
export async function seedFavoriteFixture(
    db: Db,
    options: SeedFavoriteFixtureOptions
): Promise<{
    favoriteId: string;
    insertableId: string;
    libraryId: string;
    groupId: string;
}> {
    const libraryId = options.libraryId ?? LibraryId.FRC_DESIGN_LIB;
    await seedLibrary(db, libraryId);
    const groupId = await seedGroup(db, { libraryId });

    let insertableId = options.insertableId;
    if (insertableId) {
        await seedInsertable(db, { id: insertableId, groupId, libraryId });
    } else {
        insertableId = await seedInsertable(db, { groupId, libraryId });
    }

    await seedUser(db, options.userId);
    const favoriteId = await seedFavorite(db, {
        favoriteId: options.favoriteId,
        userId: options.userId,
        libraryId,
        insertableId,
        sortOrder: options.sortOrder
    });
    return { favoriteId, insertableId, libraryId, groupId };
}
