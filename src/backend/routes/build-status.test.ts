import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("GET /build-status", () => {
    beforeEach(() => resetDb(db));

    it("returns each group's and insertable's last-loaded time", async () => {
        await seedPartStudio(db);
        await db
            .update(group)
            .set({ lastLoadedAt: 1000 })
            .where(eq(group.id, TEST_GROUP_ID));
        await db
            .update(insertables)
            .set({ lastLoadedAt: 2000 })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].lastLoadedAt).toBe(1000);
        expect(body.insertables[TEST_PART_STUDIO_ID].lastLoadedAt).toBe(2000);
    });

    it("reports a never-loaded entity as null", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].lastLoadedAt).toBeNull();
    });
});
