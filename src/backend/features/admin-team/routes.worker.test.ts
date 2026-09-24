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
import {
    adminTeamMembers,
    libraries,
    onshapeWebhooks,
    WebhookSubject
} from "../../db/schema";
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
    const post = vi
        .spyOn(onshapeApi, "post")
        .mockResolvedValue({ id: "team-webhook" });
    return { onshapeApi, post };
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

    it("stores the team's members and registers its webhook", async () => {
        const { onshapeApi, post } = mockOnshape();

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
        expect(post).toHaveBeenCalledOnce();
        expect(
            await db
                .select({ subject: onshapeWebhooks.subject })
                .from(onshapeWebhooks)
                .all()
        ).toEqual([{ subject: WebhookSubject.TEAM }]);
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

    it("takes the team away, and its webhook with it", async () => {
        const { onshapeApi } = mockOnshape();
        const remove = vi
            .spyOn(onshapeApi, "deleteNone")
            .mockResolvedValue(undefined);
        await setTeam("team", onshapeApi);

        const res = await setTeam(null, onshapeApi);

        expect(await res.json()).toEqual({ teamId: null, memberCount: 0 });
        expect(remove).toHaveBeenCalledWith("/webhooks/team-webhook");
    });
});
