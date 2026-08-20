import { env } from "cloudflare:workers";
import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { group } from "../../db/schema";
import {
    resetDb,
    seedGroup,
    seedLibrary,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID
} from "../../../__test_utils__";
import { placeNewGroup } from "./db";

const db = getDb(env.DB);

/**
 * Inserts a minimal group row at the given sort order — mirrors what the load-group
 * workflow writes once `placeNewGroup` has told it where the new group belongs.
 */
async function insertGroupAt(id: string, sortOrder: number): Promise<void> {
    await db.insert(group).values({
        id,
        libraryId: TEST_LIBRARY_ID,
        documentId: `doc-${id}`,
        name: id,
        versionId: "v1",
        sortOrder
    });
}

describe("placeNewGroup", () => {
    beforeEach(() => resetDb(db));

    it("returns the end position and leaves existing groups untouched by default", async () => {
        await seedGroup(db, TEST_GROUP_ID); // sortOrder 0

        const sortOrder = await placeNewGroup(db, TEST_LIBRARY_ID, undefined);
        expect(sortOrder).toBe(1);

        const rows = await db
            .select()
            .from(group)
            .orderBy(asc(group.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual([TEST_GROUP_ID]);
        expect(rows[0].sortOrder).toBe(0);
    });

    it("returns a position directly after selectedGroupId, renumbering later groups", async () => {
        await seedLibrary(db, TEST_LIBRARY_ID);
        await insertGroupAt("g1", 0);
        await insertGroupAt("g2", 1);
        await insertGroupAt("g3", 2);

        // Open a slot right after g1.
        const sortOrder = await placeNewGroup(db, TEST_LIBRARY_ID, "g1");
        expect(sortOrder).toBe(1);

        // g1.5 itself is never inserted by placeNewGroup — only the existing
        // siblings get renumbered to make room for it.
        const rows = await db
            .select()
            .from(group)
            .orderBy(asc(group.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual(["g1", "g2", "g3"]);
        expect(rows.map((r) => r.sortOrder)).toEqual([0, 2, 3]);
    });
});
