import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurations, groups, insertables } from "../../db/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS,
    TEST_PART_STUDIO_ID,
    createTestApp,
    resetDb,
    seedGroup,
    seedInsertable,
    seedPartStudio
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import type { LibraryBuildStatus } from "./contract";

const db = getDb(env.DB);

const GROUP_VERSION_AT = new Date(1000);
const INSERTABLE_VERSION_AT = new Date(2000);

describe("GET /build-status", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    // The version's date, not the sync's.
    it("returns each group's and insertable's version date", async () => {
        await seedPartStudio(db);
        await db
            .update(groups)
            .set({
                versionCreatedAt: GROUP_VERSION_AT,
                lastLoadedAt: new Date()
            })
            .where(eq(groups.id, TEST_GROUP_ID));
        await db
            .update(insertables)
            .set({
                versionCreatedAt: INSERTABLE_VERSION_AT,
                lastLoadedAt: new Date()
            })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].versionCreatedAt).toBe(
            GROUP_VERSION_AT.getTime()
        );
        expect(body.insertables[TEST_PART_STUDIO_ID].versionCreatedAt).toBe(
            INSERTABLE_VERSION_AT.getTime()
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
        await seedGroup(db, TEST_GROUP_ID, TEST_LIBRARY_ID, {
            versionCreatedAt: null
        });
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].versionCreatedAt).toBeUndefined();
    });

    // D1 binds at most 100 parameters, and `inArray` binds one per value.
    it("serves a library with more insertables than a statement can bind", async () => {
        const count = 120;
        await seedGroup(db);
        for (let i = 0; i < count; i++) {
            const id = `ins-${i}`;
            await seedInsertable(db, { id, elementId: `e-${i}` });
            await db.insert(configurations).values({
                insertableId: id,
                parameters: TEST_PARAMETERS,
                records: []
            });
        }

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(Object.keys(body.insertables)).toHaveLength(count);
        // The configurations come back joined, not just the insertables.
        expect(body.insertables["ins-119"].configuration?.parameters).toEqual(
            TEST_PARAMETERS
        );
    });

    // A removed check would render as a blank callout.
    it("drops a stored issue whose type this build no longer has", async () => {
        await seedPartStudio(db);
        // Written as raw JSON, the way the deploy that still had the check did.
        await db.run(
            sql`update groups set build_issues = '[{"type":"thumbnail-pending"},{"type":"load-failed"}]' where id = ${TEST_GROUP_ID}`
        );

        const res = await createTestApp().request(
            `/api/build-status/library/${TEST_LIBRARY_ID}?v=1`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryBuildStatus = await res.json();
        expect(body.groups[TEST_GROUP_ID].buildIssues).toEqual([
            { type: "load-failed" }
        ]);
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
