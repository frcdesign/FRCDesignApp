import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { groups, libraries, PLACEHOLDER_VERSION_ID } from "../../db/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import { createShellGroup, type AddGroupParams } from "./workflows";

const db = getDb(env.DB);

const PARAMS: AddGroupParams = {
    groupId: "new-group",
    documentId: "doc-new",
    documentName: "New Doc",
    libraryId: TEST_LIBRARY_ID,
    sessionId: "test-session"
};

function readVersion(): Promise<number | undefined> {
    return db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, TEST_LIBRARY_ID))
        .get()
        .then((row) => row?.cacheVersion);
}

describe("createShellGroup", () => {
    beforeEach(() => resetDb(db));

    it("writes the group as unloaded, after the selected one", async () => {
        // Seeding a group creates the library, so there is a version to move.
        await seedGroup(db);

        await createShellGroup(env, {
            ...PARAMS,
            selectedGroupId: TEST_GROUP_ID
        });

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((row) => row.id)).toEqual([
            TEST_GROUP_ID,
            PARAMS.groupId
        ]);
        const shell = rows[1];
        expect(shell.name).toBe(PARAMS.documentName);
        expect(shell.versionId).toBe(PLACEHOLDER_VERSION_ID);
        expect(shell.lastLoadedAt).toBeNull();
    });

    // The row lands before the load runs, but every library response is pinned
    // to the cache version, so without a bump nothing can fetch the group until
    // the load finishes — hours, for a large document.
    it("bumps the library version, so the group is reachable", async () => {
        await seedGroup(db);
        const startVersion = await readVersion();

        await createShellGroup(env, PARAMS);

        expect(await readVersion()).toBeGreaterThan(startVersion ?? 0);
    });
});
