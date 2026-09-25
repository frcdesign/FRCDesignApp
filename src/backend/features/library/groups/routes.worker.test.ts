import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { favorites, groups, insertables } from "../../../db/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup,
    seedInsertable,
    seedTestData
} from "../../../../__test_utils__";
import MiniSearch from "minisearch";
import { getDb } from "../../../db/client";
import type { JobStatus } from "../../load/contract";
import { searchIndexKey } from "../db";
import { SEARCH_OPTIONS, type SearchDocument } from "../../search/contract";
import * as DocumentsEndpoint from "../../../lib/onshape/endpoints/documents";
import * as Reconcile from "../../thumbnails/reconcile";
import * as Jobs from "../../load/jobs";

const db = getDb(env.DB);

/** `getSessionId` reads the cookie directly, bypassing the mocks. */
function sessionRequest(method: string, body?: unknown): RequestInit {
    const init = jsonRequest(method, body);
    return {
        ...init,
        headers: {
            ...init.headers,
            Cookie: "frc-design-app-cookie=test-session"
        }
    };
}

describe("group admin routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("POST /set-insertable-visibility hides an insertable and drops its favorites", async () => {
        await seedTestData(db);

        const res = await createTestApp().request(
            `/api/set-insertable-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                insertableIds: [TEST_PART_STUDIO_ID],
                isVisible: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const insertable = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID))
            .get();
        expect(insertable?.isVisible).toBe(false);

        const remaining = await db
            .select()
            .from(favorites)
            .where(eq(favorites.insertableId, TEST_PART_STUDIO_ID))
            .all();
        expect(remaining).toHaveLength(0);
    });

    // Search reads isVisible from the index.
    it.each([false, true])(
        "POST /set-insertable-visibility rebuilds the search index (isVisible=%s)",
        async (isVisible) => {
            await seedTestData(db);

            const res = await createTestApp().request(
                `/api/set-insertable-visibility/library/${TEST_LIBRARY_ID}`,
                jsonRequest("POST", {
                    insertableIds: [TEST_PART_STUDIO_ID],
                    isVisible
                }),
                env
            );
            expect(res.status).toBe(200);

            const object = await env.BLOB.get(searchIndexKey(TEST_LIBRARY_ID));
            const indexed = MiniSearch.loadJSON<SearchDocument>(
                await object!.text(),
                SEARCH_OPTIONS
            ).getStoredFields(TEST_PART_STUDIO_ID);
            expect(indexed?.isVisible).toBe(isVisible);
        }
    );

    // "Hide all" sends a whole group; D1 binds at most 100 parameters.
    it("POST /set-insertable-visibility handles more ids than a statement can bind", async () => {
        const count = 120;
        await seedGroup(db);
        const insertableIds: string[] = [];
        for (let i = 0; i < count; i++) {
            insertableIds.push(
                await seedInsertable(db, {
                    id: `ins-${i}`,
                    elementId: `e-${i}`,
                    isVisible: true
                })
            );
        }

        const res = await createTestApp().request(
            `/api/set-insertable-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", { insertableIds, isVisible: false }),
            env
        );
        expect(res.status).toBe(200);

        const rows = await db.select().from(insertables).all();
        expect(rows).toHaveLength(count);
        expect(rows.every((row) => !row.isVisible)).toBe(true);
    });

    it("POST /sort-group-alphabetically updates the flag", async () => {
        await seedTestData(db);

        const res = await createTestApp().request(
            `/api/sort-group-alphabetically/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                groupId: TEST_GROUP_ID,
                sortAlphabetically: true
            }),
            env
        );
        expect(res.status).toBe(200);

        const groupRow = await db
            .select()
            .from(groups)
            .where(eq(groups.id, TEST_GROUP_ID))
            .get();
        expect(groupRow?.sortAlphabetically).toBe(true);
    });

    it("POST /group-order reorders groups", async () => {
        await seedTestData(db);
        await seedGroup(db, "test-group-2");

        const res = await createTestApp().request(
            `/api/group-order/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                groupOrder: ["test-group-2", TEST_GROUP_ID]
            }),
            env
        );
        expect(res.status).toBe(200);

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual(["test-group-2", TEST_GROUP_ID]);
    });

    it("DELETE /group removes the group and cascades to its insertables", async () => {
        await seedTestData(db);

        const res = await createTestApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}?groupId=${TEST_GROUP_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(res.status).toBe(200);

        expect(await db.select().from(groups).all()).toHaveLength(0);
        expect(await db.select().from(insertables).all()).toHaveLength(0);
    });

    it("DELETE /group cleans up the thumbnails of the elements it had", async () => {
        await seedTestData(db);
        const elementIds = (
            await db
                .select({ elementId: insertables.elementId })
                .from(insertables)
        ).map((row) => row.elementId);
        const clean = vi
            .spyOn(Reconcile, "deleteStaleThumbnails")
            .mockResolvedValue(0);

        await createTestApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}?groupId=${TEST_GROUP_ID}`,
            jsonRequest("DELETE"),
            env
        );

        expect(clean.mock.calls[0][2].elementIds).toEqual(
            expect.arrayContaining(elementIds)
        );
        clean.mockRestore();
    });
});

describe("GET /job-status", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it.each<JobStatus>([
        { loadingGroupIds: [TEST_GROUP_ID], awaitingApprovalGroupIds: [] },
        { loadingGroupIds: [], awaitingApprovalGroupIds: [TEST_GROUP_ID] }
    ])("reports $loadingGroupIds loading", async (status) => {
        vi.spyOn(Jobs, "getJobStatus").mockResolvedValue(status);

        const res = await createTestApp().request(
            `/api/job-status/library/${TEST_LIBRARY_ID}`,
            sessionRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(status);
        // Asked for live state, so it must never be served from a cache.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });
});

describe("POST /group", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("writes the group after the selected one, and asks for its load", async () => {
        await seedGroup(db, TEST_GROUP_ID); // sortOrder 0
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            id: "doc-new",
            name: "New Doc"
        });
        const loadSpy = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

        const res = await createTestApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST", {
                newDocumentId: "doc-new",
                selectedGroupId: TEST_GROUP_ID
            }),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ name: "New Doc" });

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((row) => row.documentId)).toEqual([
            `doc-${TEST_GROUP_ID}`,
            "doc-new"
        ]);
        expect(loadSpy).toHaveBeenCalledWith(expect.anything(), [
            {
                libraryId: TEST_LIBRARY_ID,
                groupId: rows[1].id,
                sessionId: "test-session",
                forceReload: false,
                origin: "http://localhost"
            }
        ]);
    });

    it("422s when the document was already added", async () => {
        await seedGroup(db, TEST_GROUP_ID); // documentId "doc-test-group"
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            id: "doc-test-group",
            name: "Dup"
        });
        const loadSpy = vi.spyOn(Jobs, "requestLoads");

        const res = await createTestApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST", { newDocumentId: `doc-${TEST_GROUP_ID}` }),
            env
        );
        expect(res.status).toBe(422);
        expect(loadSpy).not.toHaveBeenCalled();
    });
});
