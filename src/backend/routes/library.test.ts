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
import { rebuildSearchDb, searchIndexKey } from "../library-data";
import { LibraryOut } from "../../shared/api-models";
import { LibraryId } from "../../shared/types";

const db = getDb(env.DB);

describe("library routes", () => {
    beforeEach(async () => {
        await resetDb(db);
        // The R2 bucket persists across tests in this file; clear the index.
        await env.SEARCH_INDEX.delete(searchIndexKey(TEST_LIBRARY_ID));
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

    it("GET /search-db serves the library's index from R2 as plain JSON", async () => {
        await seedTestData(db);
        await seedConfiguration(db, TEST_PART_STUDIO_ID);
        await rebuildSearchDb(env.SEARCH_INDEX, db, TEST_LIBRARY_ID);
        const app = createTestApp();

        const res = await app.request(
            `/api/search-db/library/${TEST_LIBRARY_ID}?v=1`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        // Serving a pre-compressed body under a hand-set Content-Encoding gets
        // it compressed a second time by the runtime, leaving the client with a
        // gzip stream after it inflates once. Wire compression is the
        // platform's job, so this response must claim no encoding of its own.
        expect(res.headers.get("Content-Encoding")).toBeNull();
        expect(res.headers.get("Content-Type")).toBe("application/json");

        // The body is the serialized MiniSearch index (a JSON object).
        const parsed: { documentCount: number } = await res.json();
        expect(parsed.documentCount).toBeGreaterThan(0);
    });

    it("GET /search-db 404s when the library has no index", async () => {
        await seedLibrary(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/search-db/library/${TEST_LIBRARY_ID}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(404);
    });

    it("GET /library-version returns the library's version", async () => {
        await seedLibrary(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/library-version/library/${TEST_LIBRARY_ID}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ version: 0 });
        // Must stay fresh: it is what busts every other library response.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("GET /library-version reports 0 for a library with no row yet", async () => {
        const app = createTestApp();

        const res = await app.request(
            `/api/library-version/library/${LibraryId.MKCAD}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ version: 0 });
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
