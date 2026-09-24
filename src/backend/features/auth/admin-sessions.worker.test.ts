import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_LIBRARY_ID, resetDb, seedLibrary } from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { getDb } from "../../db/client";
import { adminTeamMembers } from "../../db/schema";
import { getAdminOnshapeApi, rememberAdminSession } from "./admin-sessions";
import * as RequestAuth from "./request-auth";

const db = getDb(env.DB);
const OWNER = "owner";

/** Each session id answers with its own api, unless it is in `dead`. */
function sessions(dead: string[] = []) {
    const apis = new Map<string, MockOnshapeApi>();
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockImplementation(
        (_kv, sessionId) => {
            if (dead.includes(sessionId)) {
                return Promise.reject(new Error("expired"));
            }
            const api = new MockOnshapeApi();
            vi.spyOn(api, "get").mockResolvedValue({ id: sessionId });
            apis.set(sessionId, api);
            return Promise.resolve(api);
        }
    );
    return apis;
}

describe("finding an admin's session", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedLibrary(db);
        await env.KV.delete(`admin-session:${OWNER}`);
        await db.insert(adminTeamMembers).values([
            {
                libraryId: TEST_LIBRARY_ID,
                userId: "member",
                isTeamAdmin: false
            },
            { libraryId: TEST_LIBRARY_ID, userId: "admin", isTeamAdmin: true }
        ]);
        await rememberAdminSession(env.KV, "member", "member-session");
        await rememberAdminSession(env.KV, "admin", "admin-session");
    });
    afterEach(() => vi.restoreAllMocks());

    const find = () =>
        getAdminOnshapeApi({ ...env, OWNER_USER_ID: OWNER }, [TEST_LIBRARY_ID]);

    it("prefers the owner's", async () => {
        await rememberAdminSession(env.KV, OWNER, "owner-session");
        const apis = sessions();

        expect(await find()).toBe(apis.get("owner-session"));
    });

    it("falls back to a team admin's, never a member's", async () => {
        await rememberAdminSession(env.KV, OWNER, "owner-session");
        const apis = sessions(["owner-session"]);

        expect(await find()).toBe(apis.get("admin-session"));
    });

    it("finds nothing when no session works", async () => {
        sessions(["admin-session"]);
        expect(await find()).toBeUndefined();
    });
});
