import { type Db } from "@backend/db/client";
import {
    configurations,
    favorites,
    groups,
    insertables,
    libraries,
    users,
    loadJobs,
    onshapeWebhooks
} from "@backend/db/schema";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailyTargetMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    events,
    insertableStats,
    userStats
} from "../backend/features/analytics/schema";
import {
    ParameterType,
    type ConfigurationParameter
} from "@backend/features/configurations/contract";
import { type ElementPath, type InstancePath } from "@backend/lib/onshape/path";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";

export const TEST_LIBRARY_ID = LibraryId.FRC_DESIGN_LIB;
export const TEST_USER_ID = "test-user"; // matches createTestApp's default userId
export const TEST_GROUP_ID = "test-group";
export const TEST_PART_STUDIO_ID = "test-part-studio";
export const TEST_ASSEMBLY_ID = "test-assembly";

/** When the version the fixtures are pinned to was cut. */
export const TEST_VERSION_CREATED_AT = new Date("2026-01-02T03:04:05Z");

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

export const TEST_PARAMETERS: ConfigurationParameter[] = [
    {
        type: ParameterType.BOOLEAN,
        id: "boolean",
        name: "Test boolean",
        default: "true"
    }
];

/** D1 storage is only isolated per file, so call in `beforeEach`. */
export async function resetDb(db: Db): Promise<void> {
    // One batch, one round trip: this runs before nearly every test.
    await db.batch([
        db.delete(favorites),
        db.delete(configurations),
        db.delete(loadJobs),
        db.delete(insertables),
        db.delete(groups),
        db.delete(users),
        db.delete(libraries),
        db.delete(onshapeWebhooks),
        // Analytics has no foreign keys, so nothing cascades these away.
        db.delete(events),
        db.delete(dailyMetrics),
        db.delete(dailySourceMetrics),
        db.delete(dailyTargetMetrics),
        db.delete(dailyUserActivity),
        db.delete(insertableStats),
        db.delete(dailyInsertableMetrics),
        db.delete(dailyInsertableUsers),
        db.delete(dailyConfigurationMetrics),
        db.delete(userStats)
    ]);
}

export async function seedLibrary(
    db: Db,
    id: LibraryId = TEST_LIBRARY_ID
): Promise<string> {
    await db.insert(libraries).values({ id }).onConflictDoNothing();
    return id;
}

/** Also seeds the default library its dead `library_id` column falls back to. */
export async function seedUser(
    db: Db,
    id: string = TEST_USER_ID
): Promise<string> {
    await seedLibrary(db, DEFAULT_LIBRARY);
    await db.insert(users).values({ id }).onConflictDoNothing();
    return id;
}

/** Seeds a fully loaded group; pass overrides for e.g. an unloaded shell. */
export async function seedGroup(
    db: Db,
    id: string = TEST_GROUP_ID,
    libraryId: LibraryId = TEST_LIBRARY_ID,
    overrides: Partial<typeof groups.$inferInsert> = {}
): Promise<string> {
    await seedLibrary(db, libraryId);
    await db
        .insert(groups)
        .values({
            id,
            libraryId,
            name: "Test Group",
            documentId: `doc-${id}`,
            versionId: "inst-1",
            lastLoadedAt: new Date(),
            versionCreatedAt: TEST_VERSION_CREATED_AT,
            ...overrides
        })
        .onConflictDoNothing();
    return id;
}

/** Defaults to the standard part studio. */
export async function seedInsertable(
    db: Db,
    overrides: Partial<typeof insertables.$inferInsert> = {}
): Promise<string> {
    const elementType = overrides.elementType ?? ElementType.PART_STUDIO;
    const values = {
        id: TEST_PART_STUDIO_ID,
        groupId: TEST_GROUP_ID,
        libraryId: TEST_LIBRARY_ID,
        elementId: TEST_PART_STUDIO_PATH.elementId,
        documentId: TEST_PART_STUDIO_PATH.documentId,
        versionId: TEST_PART_STUDIO_PATH.instanceId,
        elementType,
        name: `Test ${elementType}`,
        microversionId: "mv-1",
        ...overrides
    };
    await db.insert(insertables).values(values).onConflictDoNothing();
    return values.id;
}

/** Seeds the standard part-studio insertable (ensures library + groups). */
export async function seedPartStudio(
    db: Db,
    overrides: Partial<typeof insertables.$inferInsert> = {}
): Promise<string> {
    await seedGroup(db);
    return seedInsertable(db, overrides);
}

/** Seeds the standard assembly insertable (ensures library + groups). */
export async function seedAssembly(db: Db): Promise<string> {
    await seedGroup(db);
    return seedInsertable(db, {
        id: TEST_ASSEMBLY_ID,
        elementId: TEST_ASSEMBLY_PATH.elementId,
        elementType: ElementType.ASSEMBLY
    });
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

/** Configurations are 1:1 with insertables and share their id. */
export async function seedConfiguration(
    db: Db,
    insertableId: string = TEST_PART_STUDIO_ID
): Promise<void> {
    await db
        .insert(configurations)
        .values({
            insertableId,
            parameters: TEST_PARAMETERS
        })
        .onConflictDoNothing();
}

/** A library, a user, a group, a part studio, an assembly, and a favorite on each. */
export async function seedTestData(db: Db): Promise<void> {
    await seedLibrary(db);
    await seedGroup(db);
    await seedPartStudio(db);
    await seedAssembly(db);
    await seedFavorite(db, TEST_PART_STUDIO_ID, TEST_USER_ID, 0);
    await seedFavorite(db, TEST_ASSEMBLY_ID, TEST_USER_ID, 1);
}
