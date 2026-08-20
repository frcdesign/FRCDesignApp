import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { favorites, group, insertables } from "../../shared/schema";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup,
    seedTestData
} from "../../__test_utils__";
import MiniSearch from "minisearch";
import { getDb } from "../db";
import type { JobStatus } from "../../shared/library-dto";
import { searchIndexKey } from "../library-data";
import { SEARCH_OPTIONS, type SearchDocument } from "../../shared/search";
import * as DocumentsEndpoint from "../onshape-api/endpoints/documents";
import * as JobTracker from "../load/job-tracker";

const db = getDb(env.DB);

/**
 * `jsonRequest` plus a session cookie, for routes calling `getSessionId` — which
 * reads the request directly rather than going through the mocked services.
 */
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

    // Search reads isVisible out of the index, not the row, so leaving it stale
    // drops the insertable from every result until the next full load.
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
            .from(group)
            .where(eq(group.id, TEST_GROUP_ID))
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
            .from(group)
            .orderBy(asc(group.sortOrder))
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

        expect(await db.select().from(group).all()).toHaveLength(0);
        expect(await db.select().from(insertables).all()).toHaveLength(0);
    });
});

describe("POST /reload-groups", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    // The "false" case is a regression test: z.coerce.boolean() reads the string
    // "false" as true, so passing forceReload=false used to force a reload.
    it.each([
        ["omitted", "", false],
        ["false", "?forceReload=false", false],
        ["true", "?forceReload=true", true]
    ])(
        "triggers one library workflow with forceReload %s",
        async (_label, query, forceReload) => {
            await seedGroup(db, TEST_GROUP_ID);
            vi.spyOn(JobTracker, "isReloadRunning").mockResolvedValue(false);
            const trackSpy = vi
                .spyOn(JobTracker, "trackJob")
                .mockResolvedValue();
            const createSpy = vi
                .spyOn(env.LOAD_LIBRARY_WORKFLOW, "create")
                .mockResolvedValue({ id: "wf" } as never);

            const res = await createTestApp().request(
                `/api/reload-groups/library/${TEST_LIBRARY_ID}${query}`,
                sessionRequest("POST"),
                env
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "triggered" });
            expect(createSpy).toHaveBeenCalledOnce();
            expect(createSpy.mock.calls[0][0]?.params).toEqual({
                libraryId: TEST_LIBRARY_ID,
                sessionId: "test-session",
                forceReload
            });
            // The new run's instance id is tracked for the running-job checks.
            expect(trackSpy).toHaveBeenCalledWith(
                expect.anything(),
                TEST_LIBRARY_ID,
                "reload",
                "wf"
            );
        }
    );

    it("skips creating a workflow when a reload is already running", async () => {
        await seedGroup(db, TEST_GROUP_ID);
        vi.spyOn(JobTracker, "isReloadRunning").mockResolvedValue(true);
        const createSpy = vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "create");

        const res = await createTestApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "already-running" });
        expect(createSpy).not.toHaveBeenCalled();
    });
});

describe("GET /job-status", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it.each<JobStatus>([
        { running: true, runningForMs: 4_000 },
        { running: false }
    ])("reports $running", async (status) => {
        vi.spyOn(JobTracker, "getJobStatus").mockResolvedValue(status);

        const res = await createTestApp().request(
            `/api/job-status/library/${TEST_LIBRARY_ID}`,
            sessionRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(status);
        // Polled for live state, so it must never be served from a cache.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });
});

describe("POST /group", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("forwards selectedGroupId and triggers the workflow, without writing the group row itself", async () => {
        await seedGroup(db, TEST_GROUP_ID); // sortOrder 0
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            id: "doc-new",
            name: "New Doc"
        });
        const createSpy = vi
            .spyOn(env.ADD_GROUP_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);
        const trackSpy = vi.spyOn(JobTracker, "trackJob").mockResolvedValue();

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

        expect(createSpy).toHaveBeenCalledOnce();
        const params = createSpy.mock.calls[0][0]?.params;
        expect(params).toMatchObject({
            groupId: expect.any(String),
            documentId: "doc-new",
            libraryId: TEST_LIBRARY_ID,
            sessionId: "test-session",
            selectedGroupId: TEST_GROUP_ID
        });
        expect(trackSpy).toHaveBeenCalledWith(
            expect.anything(),
            TEST_LIBRARY_ID,
            "add-group",
            "wf"
        );

        // The route (the workflow is mocked here) doesn't compute or write sort
        // order itself anymore — only the existing group exists, untouched.
        const rows = await db.select().from(group).all();
        expect(rows.map((r) => r.documentId)).toEqual([`doc-${TEST_GROUP_ID}`]);
        expect(rows[0].sortOrder).toBe(0);
    });

    it("422s when the document was already added", async () => {
        await seedGroup(db, TEST_GROUP_ID); // documentId "doc-test-group"
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            id: "doc-test-group",
            name: "Dup"
        });
        const createSpy = vi
            .spyOn(env.ADD_GROUP_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await createTestApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST", { newDocumentId: `doc-${TEST_GROUP_ID}` }),
            env
        );
        expect(res.status).toBe(422);
        expect(createSpy).not.toHaveBeenCalled();
    });
});
