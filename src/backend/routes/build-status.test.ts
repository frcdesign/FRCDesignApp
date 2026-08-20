import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { group, insertables } from "../../shared/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    resetDb,
    seedPartStudio
} from "../../__test_utils__";
import { getDb } from "../db";
import type { LibraryBuildStatus } from "../../shared/api-models";

const db = getDb(env.DB);

const GROUP_LOADED_AT = 1000;
const INSERTABLE_LOADED_AT = 2000;

describe("GET /build-status", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("returns each group's and insertable's last-loaded time", async () => {
        await seedPartStudio(db);
        await db
            .update(group)
            .set({ lastLoadedAt: GROUP_LOADED_AT })
            .where(eq(group.id, TEST_GROUP_ID));
        await db
            .update(insertables)
            .set({ lastLoadedAt: INSERTABLE_LOADED_AT })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].lastLoadedAt).toBe(GROUP_LOADED_AT);
        expect(body.insertables[TEST_PART_STUDIO_ID].lastLoadedAt).toBe(
            INSERTABLE_LOADED_AT
        );
    });

    it("caches privately, since only editors may read it", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=2`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe(
            "private, max-age=31536000, immutable"
        );
    });

    it("reports a never-loaded entity as null", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].lastLoadedAt).toBeNull();
    });

    // Job state lives on /job-status, which is what lets this be cached.
    it("caches the response privately and immutably", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe(
            "private, max-age=31536000, immutable"
        );
    });
});
