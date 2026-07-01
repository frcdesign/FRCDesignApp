import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { favorites, groups, insertables } from "../../shared/schema";
import { AccessLevel } from "../../shared/types";
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
import * as VersionsEndpoint from "../onshape-api/endpoints/versions";
import * as DocumentsEndpoint from "../onshape-api/endpoints/documents";

const db = getDb(env.DB);
const adminApp = () => createTestApp({ accessLevel: AccessLevel.ADMIN });

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

        const res = await adminApp().request(
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

    it("POST /set-element-visibility is forbidden without admin access", async () => {
        await seedTestData(db);
        const res = await createTestApp().request(
            `/api/set-element-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                insertableIds: [TEST_PART_STUDIO_ID],
                isVisible: false
            }),
            env
        );
        expect(res.status).toBe(403);
    });

    it("POST /sort-group-alphabetically updates the flag", async () => {
        await seedTestData(db);

        const res = await adminApp().request(
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
            .from(groups)
            .where(eq(groups.id, TEST_GROUP_ID))
            .get();
        expect(group?.sortAlphabetically).toBe(true);
    });

    it("POST /group-order reorders groups", async () => {
        await seedTestData(db);
        await seedGroup(db, "test-group-2");

        const res = await adminApp().request(
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

        const res = await adminApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}?groupId=${TEST_GROUP_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(res.status).toBe(200);

        expect(await db.select().from(groups).all()).toHaveLength(0);
        expect(await db.select().from(insertables).all()).toHaveLength(0);
    });
});

describe("POST /reload-groups", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("only triggers the workflow for groups whose latest version changed", async () => {
        await seedGroup(db, "unchanged"); // instanceId "inst-1" (seedGroup default)
        await seedGroup(db, "changed");
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockImplementation(
            (_api, { documentId }) =>
                Promise.resolve({
                    id: documentId === "doc-unchanged" ? "inst-1" : "inst-2",
                    name: "v",
                    createdAt: "2020-01-01T00:00:00Z"
                })
        );
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await adminApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 1 });
        expect(createSpy).toHaveBeenCalledOnce();
        expect(createSpy.mock.calls[0][0]).toMatchObject({
            params: { groupId: "changed" }
        });
    });

    it("triggers every group when forceReload=true", async () => {
        await seedGroup(db, "unchanged");
        await seedGroup(db, "changed");
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockImplementation(
            (_api, { documentId }) =>
                Promise.resolve({
                    id: documentId === "doc-unchanged" ? "inst-1" : "inst-2",
                    name: "v",
                    createdAt: "2020-01-01T00:00:00Z"
                })
        );
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await adminApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}?forceReload=true`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 2 });
        expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it("skips a group whose document can no longer be reached", async () => {
        await seedGroup(db, "broken");
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockRejectedValue(
            new Error("not found")
        );
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await adminApp().request(
            `/api/reload-groups/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "triggered", count: 0 });
        expect(createSpy).not.toHaveBeenCalled();
    });
});

describe("POST /group", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("creates the group, orders it, and triggers the workflow", async () => {
        await seedGroup(db, TEST_GROUP_ID);
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "New Doc"
        });
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockResolvedValue({
            id: "inst-new",
            name: "v",
            createdAt: "2020-01-01T00:00:00Z"
        });
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await adminApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST", { newDocumentId: "doc-new" }),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ name: "New Doc" });

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((r) => r.documentId)).toEqual([
            `doc-${TEST_GROUP_ID}`,
            "doc-new"
        ]);

        expect(createSpy).toHaveBeenCalledOnce();
        const params = createSpy.mock.calls[0][0]?.params;
        expect(params).toMatchObject({
            groupId: rows[1].id,
            version: { instanceId: "inst-new" }
        });
    });

    it("422s when the document was already added", async () => {
        await seedGroup(db, TEST_GROUP_ID); // documentId "doc-test-group"
        vi.spyOn(DocumentsEndpoint, "getDocument").mockResolvedValue({
            name: "Dup"
        });
        vi.spyOn(VersionsEndpoint, "getLatestVersion").mockResolvedValue({
            id: "inst-1",
            name: "v",
            createdAt: "2020-01-01T00:00:00Z"
        });
        const createSpy = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
            .mockResolvedValue({ id: "wf" } as never);

        const res = await adminApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}`,
            sessionRequest("POST", { newDocumentId: `doc-${TEST_GROUP_ID}` }),
            env
        );
        expect(res.status).toBe(422);
        expect(createSpy).not.toHaveBeenCalled();
    });
});
