import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./db";
import { groups, libraries } from "../shared/schema";
import {
    resetDb,
    seedGroup,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID
} from "../__test_utils__";
import { createOrderedGroup } from "./library-data";

const db = getDb(env.DB);

describe("createOrderedGroup", () => {
    beforeEach(() => resetDb(db));

    it("creates the library row and appends the group at the end by default", async () => {
        await seedGroup(db, TEST_GROUP_ID); // sortOrder 0

        await createOrderedGroup(db, {
            groupId: "new-group",
            libraryId: TEST_LIBRARY_ID,
            documentId: "doc-new",
            name: "New Group",
            instanceId: "inst-1",
            selectedGroupId: undefined
        });

        const library = await db
            .select()
            .from(libraries)
            .where(eq(libraries.id, TEST_LIBRARY_ID))
            .get();
        expect(library).toBeDefined();

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual([TEST_GROUP_ID, "new-group"]);
        expect(rows.find((r) => r.id === "new-group")).toMatchObject({
            documentId: "doc-new",
            name: "New Group",
            instanceId: "inst-1",
            sortOrder: 1
        });
    });

    it("inserts directly after selectedGroupId, renumbering later groups", async () => {
        await seedGroup(db, "g1"); // sortOrder 0
        await db
            .update(groups)
            .set({ sortOrder: 0 })
            .where(eq(groups.id, "g1"));
        await createOrderedGroup(db, {
            groupId: "g2",
            libraryId: TEST_LIBRARY_ID,
            documentId: "doc-2",
            name: "G2",
            instanceId: "inst-2",
            selectedGroupId: undefined
        });
        await createOrderedGroup(db, {
            groupId: "g3",
            libraryId: TEST_LIBRARY_ID,
            documentId: "doc-3",
            name: "G3",
            instanceId: "inst-3",
            selectedGroupId: undefined
        });
        // Order is now [g1, g2, g3]; insert a new group right after g1.
        await createOrderedGroup(db, {
            groupId: "g1.5",
            libraryId: TEST_LIBRARY_ID,
            documentId: "doc-1.5",
            name: "G1.5",
            instanceId: "inst-1.5",
            selectedGroupId: "g1"
        });

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual(["g1", "g1.5", "g2", "g3"]);
        expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3]);
    });
});
