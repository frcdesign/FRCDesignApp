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
            `/api/library-data/library/${TEST_LIBRARY_ID}?v=1`,
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
    });

    it("GET /search-db returns a serialized search index", async () => {
        await seedLibrary(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/search-db/library/${TEST_LIBRARY_ID}?v=1`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body: { searchDb: string } = await res.json();
        expect(typeof body.searchDb).toBe("string");
        expect(body.searchDb.length).toBeGreaterThan(0);
    });

    it("caches version-keyed responses immutably", async () => {
        await seedTestData(db);
        const app = createTestApp();

        for (const path of ["library-data", "search-db"]) {
            const res = await app.request(
                `/api/${path}/library/${TEST_LIBRARY_ID}?v=3`,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(200);
            expect(res.headers.get("Cache-Control")).toBe(
                "public, max-age=31536000, immutable"
            );
        }
    });

    it.each(["library-data", "search-db"])(
        "rejects a %s request with no cache version",
        async (path) => {
            await seedTestData(db);
            const app = createTestApp();

            const res = await app.request(
                `/api/${path}/library/${TEST_LIBRARY_ID}`,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(400);
        }
    );

    it("rejects an unknown library", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/library-data/library/not-a-library?v=1",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(400);
    });
});
