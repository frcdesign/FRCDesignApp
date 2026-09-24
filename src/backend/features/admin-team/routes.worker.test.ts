import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_LIBRARY_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedLibrary
} from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { getDb } from "../../db/client";
import { adminTeamMembers, libraries } from "../../db/schema";
import { OnshapeApiError } from "../../lib/onshape/client";
import { AccessLevel } from "../auth/access-level";

const db = getDb(env.DB);
const PATH = `/api/admin-team/library/${TEST_LIBRARY_ID}`;

/** Onshape, with a team of one member and one admin. */
function mockOnshape() {
    const onshapeApi = new MockOnshapeApi();
    vi.spyOn(onshapeApi, "get").mockImplementation((path: string) => {
        if (path === "/users/sessioninfo") {
            return Promise.resolve({ id: "owner", company: { id: "company" } });
        }
        if (path === "/teams/team/members") {
            return Promise.resolve({
                items: [
                    { admin: false, member: { id: "member" } },
                    { admin: true, member: { id: "team-admin" } }
                ]
            });
        }
        return Promise.reject(new OnshapeApiError("no such team", 404));
    });
    return { onshapeApi };
}

function setTeam(teamId: string | null, onshapeApi: MockOnshapeApi) {
    return createTestApp({
        accessLevel: AccessLevel.OWNER,
        onshapeApi
    }).request(PATH, jsonRequest("POST", { teamId }), env);
}

describe("setting a library's admin team", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedLibrary(db);
    });
    afterEach(() => vi.restoreAllMocks());

    it("is the owner's alone", async () => {
        const res = await createTestApp({
            accessLevel: AccessLevel.ADMIN
        }).request(PATH, jsonRequest("POST", { teamId: "team" }), env);
        expect(res.status).toBe(403);
    });

    it("stores the team's members", async () => {
        const { onshapeApi } = mockOnshape();

        const res = await setTeam("team", onshapeApi);

        expect(await res.json()).toEqual({ teamId: "team", memberCount: 2 });
        expect(
            await db
                .select({
                    userId: adminTeamMembers.userId,
                    isTeamAdmin: adminTeamMembers.isTeamAdmin
                })
                .from(adminTeamMembers)
                .all()
        ).toEqual([
            { userId: "member", isTeamAdmin: false },
            { userId: "team-admin", isTeamAdmin: true }
        ]);
    });

    // A mistyped id should not lock everyone but the owner out.
    it("keeps the team that was working when the new one cannot be read", async () => {
        const { onshapeApi } = mockOnshape();
        await setTeam("team", onshapeApi);

        const res = await setTeam("typo", onshapeApi);

        expect(res.status).toBe(422);
        const library = await db
            .select({ adminTeamId: libraries.adminTeamId })
            .from(libraries)
            .where(eq(libraries.id, TEST_LIBRARY_ID))
            .get();
        expect(library?.adminTeamId).toBe("team");
    });

    it("takes the team away", async () => {
        const { onshapeApi } = mockOnshape();
        await setTeam("team", onshapeApi);

        const res = await setTeam(null, onshapeApi);

        expect(await res.json()).toEqual({ memberCount: 0 });
    });
});

describe("refreshing a library's admin team", () => {
    const REFRESH_PATH = `/api/admin-team/refresh/library/${TEST_LIBRARY_ID}`;

    beforeEach(async () => {
        await resetDb(db);
        await seedLibrary(db);
        await db
            .update(libraries)
            .set({ adminTeamId: "team" })
            .where(eq(libraries.id, TEST_LIBRARY_ID));
    });
    afterEach(() => vi.restoreAllMocks());

    const refresh = (accessLevel: AccessLevel) =>
        createTestApp({
            accessLevel,
            onshapeApi: mockOnshape().onshapeApi
        }).request(REFRESH_PATH, jsonRequest("POST"), env);

    it("pulls the members again for an admin", async () => {
        const res = await refresh(AccessLevel.ADMIN);

        expect(await res.json()).toEqual({ teamId: "team", memberCount: 2 });
    });

    it("turns away an editor", async () => {
        expect((await refresh(AccessLevel.EDITOR)).status).toBe(403);
    });
});
