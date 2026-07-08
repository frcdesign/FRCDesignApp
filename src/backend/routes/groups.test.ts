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
import { getDb } from "../db";
import * as DocumentsEndpoint from "../onshape-api/endpoints/documents";

const db = getDb(env.DB);

/**
 * `jsonRequest` plus a session cookie — needed by routes that call `getSessionId`
 * (unlike `c.var.getOnshapeApi()`, session lookup isn't part of `createTestApp`'s
 * mocked services, since it's read directly from the request).
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

    it("POST /set-element-visibility hides an insertable and drops its favorites", async () => {
        await seedTestData(db);

        const res = await createTestApp().request(
            `/api/set-element-visibility/library/${TEST_LIBRARY_ID}`,
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

        const group = await db
            .select()
            .from(group)
            .where(eq(group.id, TEST_GROUP_ID))
            .get();
        expect(group?.sortAlphabetically).toBe(true);
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

    /** Matches seedGroup's default versionId ("inst-1") — i.e. nothing changed upstream. */
    function mockUnchangedDocument(): void {
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "Doc",
            recentVersion: { id: "inst-1", name: "v" }
        });
    }

    it("skips an unchanged group when forceReload is omitted", async () => {
        await seedGroup(db, TEST_GROUP_ID);
        mockUnchangedDocument();
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await createTestApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 0 });
        expect(createSpy).not.toHaveBeenCalled();
    });

    // Regression test: z.coerce.boolean() coerces the *string* "false" to `true`
    // (any non-empty string is truthy), so an explicit forceReload=false used to
    // force a reload just by being present. z.stringbool() fixes this.
    it("still skips an unchanged group when forceReload=false is explicit", async () => {
        await seedGroup(db, TEST_GROUP_ID);
        mockUnchangedDocument();
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await createTestApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}?forceReload=false`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 0 });
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("reloads an unchanged group when forceReload=true", async () => {
        await seedGroup(db, TEST_GROUP_ID);
        mockUnchangedDocument();
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await createTestApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}?forceReload=true`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 1 });
        expect(createSpy).toHaveBeenCalledOnce();
        expect(createSpy.mock.calls[0][0]?.params).toMatchObject({
            forceReload: true
        });
    });
});

describe("POST /group", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("forwards selectedGroupId and triggers the workflow, without writing the group row itself", async () => {
        await seedGroup(db, TEST_GROUP_ID); // sortOrder 0
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "New Doc",
            recentVersion: { id: "inst-new", name: "v" }
        });
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

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
            documentId: "doc-new",
            libraryId: TEST_LIBRARY_ID,
            isNew: true,
            selectedGroupId: TEST_GROUP_ID
        });

        // The route (the workflow is mocked here) doesn't compute or write sort
        // order itself anymore — only the existing group exists, untouched.
        const rows = await db.select().from(group).all();
        expect(rows.map((r) => r.documentId)).toEqual([`doc-${TEST_GROUP_ID}`]);
        expect(rows[0].sortOrder).toBe(0);
    });

    it("422s when the document was already added", async () => {
        await seedGroup(db, TEST_GROUP_ID); // documentId "doc-test-group"
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "Dup",
            recentVersion: { id: "inst-1", name: "v" }
        });
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
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
