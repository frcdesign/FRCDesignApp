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
import { libraries, onshapeWebhooks, WebhookSubject } from "../../db/schema";
import { OnshapeApiError } from "../../lib/onshape/client";
import { OnshapeOwnerType } from "../../lib/onshape/endpoints/teams";
import * as BackgroundSessions from "../auth/background-sessions";
import { AccessLevel } from "../auth/access-level";

const db = getDb(env.DB);
const PATH = `/api/admin-team/library/${TEST_LIBRARY_ID}`;

/** Onshape, with a company's team of one member and one admin, and a person's team. */
function mockOnshape() {
    const onshapeApi = new MockOnshapeApi();
    vi.spyOn(onshapeApi, "get").mockImplementation((path: string) => {
        if (path === "/users/sessioninfo") {
            return Promise.resolve({ id: "owner", company: { id: "company" } });
        }
        if (path === "/teams/team") {
            return Promise.resolve({
                id: "team",
                name: "Hornet Robotics",
                owner: { type: OnshapeOwnerType.COMPANY, id: "company" }
            });
        }
        if (path === "/teams/personal-team") {
            return Promise.resolve({
                id: "personal-team",
                name: "Old team",
                owner: { type: OnshapeOwnerType.USER, id: "someone" }
            });
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
    const createWebhook = vi
        .spyOn(onshapeApi, "post")
        .mockResolvedValue({ id: "team-webhook" });
    const deleteWebhook = vi
        .spyOn(onshapeApi, "deleteNone")
        .mockResolvedValue();
    return { onshapeApi, createWebhook, deleteWebhook };
}

async function adminTeamOf() {
    return (await db
        .select({
            adminTeamId: libraries.adminTeamId,
            adminTeam: libraries.adminTeam
        })
        .from(libraries)
        .where(eq(libraries.id, TEST_LIBRARY_ID))
        .get())!;
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
        const library = await db
            .select({ adminTeam: libraries.adminTeam })
            .from(libraries)
            .where(eq(libraries.id, TEST_LIBRARY_ID))
            .get();
        expect(library?.adminTeam).toEqual([
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

    // A team a person owns is an old kind Onshape can't send webhooks for.
    it("refuses a team that belongs to a person", async () => {
        const { onshapeApi } = mockOnshape();

        const res = await setTeam("personal-team", onshapeApi);

        expect(res.status).toBe(422);
        expect((await adminTeamOf()).adminTeamId).toBeNull();
    });

    it("watches the team through the company that owns it", async () => {
        const { onshapeApi, createWebhook } = mockOnshape();

        await setTeam("team", onshapeApi);

        const [path, options] = createWebhook.mock.calls[0];
        expect(path).toBe("/webhooks");
        expect(options?.body).toMatchObject({
            companyId: "company",
            events: ["onshape.team.addmember", "onshape.team.removemember"]
        });
        expect(await db.select().from(onshapeWebhooks).all()).toEqual([
            expect.objectContaining({
                subject: WebhookSubject.TEAM,
                subjectId: "team",
                webhookId: "team-webhook"
            })
        ]);
    });

    it("stops watching a team no library has any more", async () => {
        const { onshapeApi, deleteWebhook } = mockOnshape();
        await setTeam("team", onshapeApi);

        await setTeam(null, onshapeApi);

        expect(deleteWebhook).toHaveBeenCalledWith("/webhooks/team-webhook");
        expect(await db.select().from(onshapeWebhooks).all()).toEqual([]);
    });

    it("pulls the members again when Onshape says the team changed", async () => {
        const { onshapeApi } = mockOnshape();
        await setTeam("team", onshapeApi);
        const [{ token }] = await db.select().from(onshapeWebhooks).all();
        await db
            .update(libraries)
            .set({ adminTeam: [] })
            .where(eq(libraries.id, TEST_LIBRARY_ID));
        vi.spyOn(
            BackgroundSessions,
            "getBackgroundOnshapeApi"
        ).mockResolvedValue(onshapeApi);
        const deliver = (teamId: string) =>
            createTestApp().request(
                `/api/webhooks/onshape?token=${token}`,
                jsonRequest("POST", {
                    event: "onshape.team.addmember",
                    teamId
                }),
                env
            );

        // The company's other teams are no reason to sync this one.
        await deliver("another-team");
        expect((await adminTeamOf()).adminTeam).toEqual([]);

        await deliver("team");
        expect((await adminTeamOf()).adminTeam).toHaveLength(2);
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
