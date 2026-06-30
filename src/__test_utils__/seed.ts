import { type Db } from "../backend/db";
import {
    configurations,
    favorites,
    groups,
    insertables,
    libraries,
    users
} from "../shared/schema";
import {
    ConfigurationParameterType,
    type ParameterObj
} from "../shared/configuration-models";
import { type ElementPath, type InstancePath } from "../shared/onshape-path";
import { ElementType, LibraryId } from "../shared/types";

export const TEST_LIBRARY_ID = LibraryId.FRC_DESIGN_LIB;
export const TEST_USER_ID = "test-user"; // matches createTestApp's default userId
export const TEST_GROUP_ID = "test-group";
export const TEST_PART_STUDIO_ID = "test-part-studio";
export const TEST_ASSEMBLY_ID = "test-assembly";

/** Onshape paths backing the seeded insertables — also useful for API mocking. */
export const TEST_INSTANCE_PATH: InstancePath = {
    documentId: "doc-test",
    instanceId: "v-test",
    instanceType: "v"
};
export const TEST_PART_STUDIO_PATH: ElementPath = {
    ...TEST_INSTANCE_PATH,
    elementId: "e-part-studio"
};
export const TEST_ASSEMBLY_PATH: ElementPath = {
    ...TEST_INSTANCE_PATH,
    elementId: "e-assembly"
};

export const TEST_PARAMETERS: ParameterObj[] = [
    {
        type: ConfigurationParameterType.BOOLEAN,
        id: "boolean",
        name: "Test boolean",
        isCosmetic: false,
        default: "true"
    }
];

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
    id: LibraryId = TEST_LIBRARY_ID
): Promise<string> {
    await db
        .insert(libraries)
        .values({ id, searchDb: "{ fake-search-db: true }" })
        .onConflictDoNothing();
    return id;
}

export async function seedUser(
    db: Db,
    id: string = TEST_USER_ID
): Promise<string> {
    await db.insert(users).values({ id }).onConflictDoNothing();
    return id;
}

export async function seedGroup(
    db: Db,
    id: string = TEST_GROUP_ID,
    libraryId: LibraryId = TEST_LIBRARY_ID
): Promise<string> {
    await seedLibrary(db, libraryId);
    await db
        .insert(groups)
        .values({
            id,
            libraryId,
            name: "Test Group",
            documentId: `doc-${id}`,
            instanceId: "inst-1"
        })
        .onConflictDoNothing();
    return id;
}

async function seedInsertable(
    db: Db,
    id: string,
    path: ElementPath,
    elementType: ElementType
): Promise<string> {
    await db
        .insert(insertables)
        .values({
            id,
            groupId: TEST_GROUP_ID,
            libraryId: TEST_LIBRARY_ID,
            elementId: path.elementId,
            documentId: path.documentId,
            instanceId: path.instanceId,
            elementType,
            name: `Test ${elementType}`,
            microversionId: "mv-1",
            versionName: "v1",
            versionCreatedAt: new Date(0).toISOString()
        })
        .onConflictDoNothing();
    return id;
}

/** Seeds the standard part-studio insertable (ensures library + group). */
export async function seedPartStudio(db: Db): Promise<string> {
    await seedGroup(db);
    return seedInsertable(
        db,
        TEST_PART_STUDIO_ID,
        TEST_PART_STUDIO_PATH,
        ElementType.PART_STUDIO
    );
}

/** Seeds the standard assembly insertable (ensures library + group). */
export async function seedAssembly(db: Db): Promise<string> {
    await seedGroup(db);
    return seedInsertable(
        db,
        TEST_ASSEMBLY_ID,
        TEST_ASSEMBLY_PATH,
        ElementType.ASSEMBLY
    );
}

export async function seedFavorite(
    db: Db,
    insertableId: string,
    userId: string = TEST_USER_ID,
    sortOrder = 0
): Promise<string> {
    const id = crypto.randomUUID();
    await seedUser(db, userId);
    await db
        .insert(favorites)
        .values({
            id,
            userId,
            libraryId: TEST_LIBRARY_ID,
            insertableId,
            sortOrder
        })
        .onConflictDoNothing();
    return id;
}

/**
 * Seeds a configuration for a given insertable.
 * Note configurations are always 1:1 with insertables so the configuration id is also the insertable id.
 */
export async function seedConfiguration(
    db: Db,
    insertableId: string = TEST_PART_STUDIO_ID
): Promise<void> {
    await db
        .insert(configurations)
        .values({
            id: insertableId,
            parameters: TEST_PARAMETERS
        })
        .onConflictDoNothing();
}

/**
 * Seeds the canonical dataset: a library, a user, a group, a part studio, an
 * assembly, and two favorites (the user's, on the part studio and the assembly).
 */
export async function seedTestData(db: Db): Promise<void> {
    await seedLibrary(db);
    await seedGroup(db);
    await seedPartStudio(db);
    await seedAssembly(db);
    await seedFavorite(db, TEST_PART_STUDIO_ID, TEST_USER_ID, 0);
    await seedFavorite(db, TEST_ASSEMBLY_ID, TEST_USER_ID, 1);
}
