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

/** Default library used by every seed helper unless overridden. */
const LIBRARY_ID = LibraryId.FRC_DESIGN_LIB;
/** Fixed version timestamp — tests don't care about the actual value. */
const VERSION_CREATED_AT = new Date(0).toISOString();

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
    id: LibraryId = LIBRARY_ID
): Promise<string> {
    await db.insert(libraries).values({ id }).onConflictDoNothing();
    return id;
}

export async function seedUser(db: Db, id: string): Promise<string> {
    await db.insert(users).values({ id }).onConflictDoNothing();
    return id;
}

export async function seedGroup(
    db: Db,
    overrides: Partial<typeof groups.$inferInsert> = {}
): Promise<string> {
    const id = overrides.id ?? crypto.randomUUID();
    await db
        .insert(groups)
        .values({
            libraryId: LIBRARY_ID,
            name: "Test Group",
            // Unique per group so repeated fixtures don't collide on the
            // (document_id, library_id) unique index.
            documentId: `doc-${id}`,
            instanceId: "inst-1",
            ...overrides,
            id
        })
        .onConflictDoNothing();
    return id;
}

export async function seedInsertable(
    db: Db,
    overrides: Partial<typeof insertables.$inferInsert> & { groupId: string }
): Promise<string> {
    const id = overrides.id ?? crypto.randomUUID();
    await db
        .insert(insertables)
        .values({
            libraryId: LIBRARY_ID,
            elementId: `el-${id}`,
            documentId: "doc-1",
            name: "Test Insertable",
            elementType: ElementType.PART_STUDIO,
            microversionId: "mv-1",
            versionName: "v1",
            versionCreatedAt: VERSION_CREATED_AT,
            instanceId: "inst-1",
            ...overrides,
            id
        })
        .onConflictDoNothing();
    return id;
}

export async function seedFavorite(
    db: Db,
    overrides: Partial<typeof favorites.$inferInsert> & {
        userId: string;
        insertableId: string;
    }
): Promise<string> {
    const id = overrides.id ?? crypto.randomUUID();
    await db
        .insert(favorites)
        .values({ libraryId: LIBRARY_ID, ...overrides, id })
        .onConflictDoNothing();
    return id;
}

export interface FavoriteFixture {
    userId: string;
    libraryId?: LibraryId;
    favoriteId?: string;
    insertableId?: string;
    sortOrder?: number;
}

/**
 * Seeds the full foreign-key chain (library → group → insertable → user →
 * favorite) and returns the created ids.
 */
export async function seedFavoriteFixture(
    db: Db,
    fixture: FavoriteFixture
): Promise<{
    favoriteId: string;
    insertableId: string;
    libraryId: LibraryId;
    groupId: string;
}> {
    const { userId, libraryId = LIBRARY_ID, sortOrder } = fixture;
    await seedLibrary(db, libraryId);
    const groupId = await seedGroup(db, { libraryId });
    const insertableId = await seedInsertable(db, {
        id: fixture.insertableId,
        groupId,
        libraryId
    });
    await seedUser(db, userId);
    const favoriteId = await seedFavorite(db, {
        id: fixture.favoriteId,
        userId,
        insertableId,
        libraryId,
        sortOrder
    });
    return { favoriteId, insertableId, libraryId, groupId };
}
