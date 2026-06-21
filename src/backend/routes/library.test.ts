import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
    TEST_GROUP_ID,
    TEST_PART_STUDIO_ID,
    TEST_LIBRARY_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedTestData,
    seedConfiguration,
    seedLibrary
} from "../../__test_utils__";
import { getDb } from "../db";
import { LibraryOut } from "../../shared/api-models";

const db = getDb(env.DB);

describe("library routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("GET /library-data returns groups and insertables", async () => {
        await seedTestData(db);
        await seedConfiguration(db, TEST_PART_STUDIO_ID);
        const app = createTestApp();

        const res = await app.request(
            `/api/library-data/library/${TEST_LIBRARY_ID}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryOut = await res.json();

        expect(body.groupOrder).toContain(TEST_GROUP_ID);
        expect(Object.keys(body.insertables)).toContain(TEST_PART_STUDIO_ID);
        expect(body.insertables[TEST_PART_STUDIO_ID].configurationId).toBe(
            TEST_PART_STUDIO_ID
        );

        // Build-checker issues are surfaced (defaulting to an empty array).
        expect(body.groups[TEST_GROUP_ID].buildIssues).toEqual([]);
        expect(body.insertables[TEST_PART_STUDIO_ID].buildIssues).toEqual([]);
    });

    it("GET /search-db returns a serialized search index", async () => {
        await seedLibrary(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/search-db/library/${TEST_LIBRARY_ID}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body: { searchDb: string } = await res.json();
        expect(typeof body.searchDb).toBe("string");
        expect(body.searchDb.length).toBeGreaterThan(0);
    });
});
