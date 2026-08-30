import { env } from "cloudflare:workers";
import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { group, PLACEHOLDER_VERSION_ID } from "../../db/schema";
import {
    resetDb,
    seedGroup,
    seedInsertable,
    seedLibrary,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID
} from "../../../__test_utils__";
import { getLibraryOut, placeNewGroup, rebuildSearchDb } from "./db";

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

describe("rebuildSearchDb", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    // An unconfigurable insertable has no configurations row, so its part
    // number reaches search only through the insertable's own part data.
    it("indexes an unconfigurable insertable's part number", async () => {
        await seedGroup(db);
        await seedInsertable(db, {
            partMetadata: {
                partNumber: "WCP-0405",
                name: "2x1 Tube",
                description: undefined,
                material: undefined,
                vendor: undefined,
                hasMultipleParts: false,
                isOpenComposite: false
            }
        });

        const searchDb = await rebuildSearchDb(env.BLOB, db, TEST_LIBRARY_ID);

        expect(searchDb).toContain("WCP-0405");
    });
});

describe("getLibraryOut", () => {
    beforeEach(() => resetDb(db));

    it("includes a shell group whose load never finished", async () => {
        await seedGroup(db, TEST_GROUP_ID, TEST_LIBRARY_ID, {
            versionId: PLACEHOLDER_VERSION_ID,
            lastLoadedAt: null
        });

        const library = await getLibraryOut(db, TEST_LIBRARY_ID);

        expect(library.groupOrder).toEqual([TEST_GROUP_ID]);
        const shell = library.groups[TEST_GROUP_ID];
        expect(shell.isLoaded).toBe(false);
        // No version to link to, so the path stops at the document.
        expect(shell.path).toEqual({ documentId: `doc-${TEST_GROUP_ID}` });
    });

    it("pins a loaded group's path to its version", async () => {
        await seedGroup(db);

        const library = await getLibraryOut(db, TEST_LIBRARY_ID);

        const loaded = library.groups[TEST_GROUP_ID];
        expect(loaded.isLoaded).toBe(true);
        expect(loaded.path).toEqual({
            documentId: `doc-${TEST_GROUP_ID}`,
            instanceId: "inst-1",
            instanceType: "v"
        });
    });
});
