import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import {
    adminTeamMembers,
    groups,
    libraries,
    onshapeWebhooks,
    WebhookSubject
} from "../../db/schema";
import * as UserSessions from "../auth/user-sessions";
import * as Versions from "../../lib/onshape/endpoints/versions";
import { BuildIssueType } from "../build-checker/issues";
import * as Sync from "../admin-team/sync";
import * as Jobs from "../load/jobs";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { WebhookEvent } from "./registration";

const db = getDb(env.DB);
const DOCUMENT = `doc-${TEST_GROUP_ID}`;

/** Delivers a notification the way Onshape would, with `token` on the url. */
function deliver(body: object, token: string) {
    return createTestApp().request(
        `http://localhost/api/webhooks/onshape?token=${token}`,
        jsonRequest("POST", body),
        env
    );
}

async function registered(subject: WebhookSubject, subjectId: string) {
    const token = `${subject}-token`;
    await db
        .insert(onshapeWebhooks)
        .values({ subject, subjectId, token, webhookId: `${subject}-webhook` });
    return token;
}

describe("receiving a webhook", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, TEST_GROUP_ID);
    });
    afterEach(() => vi.restoreAllMocks());

    it("turns away a delivery without a registered token", async () => {
        await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        const res = await deliver({ event: "webhook.ping" }, "guess");
        expect(res.status).toBe(403);
    });

    // Registration fails unless Onshape's own check is answered.
    it("answers Onshape's registration check", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        const res = await deliver({ event: "webhook.register" }, token);
        expect(res.status).toBe(200);
    });

    describe("a new version", () => {
        const session = (sessionId: string) => ({
            sessionId,
            onshapeApi: new MockOnshapeApi()
        });
        const loadedAs = (load: ReturnType<typeof mockLoads>) =>
            load.mock.calls[0]?.[1].map((request) => request.sessionId);
        const mockLoads = () =>
            vi.spyOn(Jobs, "requestLoads").mockResolvedValue();
        const liveSessions = (byUser: Record<string, string>) =>
            vi
                .spyOn(UserSessions, "getLiveSession")
                .mockImplementation((_kv, userId) =>
                    Promise.resolve(
                        byUser[userId] ? session(byUser[userId]) : undefined
                    )
                );
        const createdBy = (creatorId: string) =>
            vi.spyOn(Versions, "getVersion").mockResolvedValue({
                id: "v-1",
                name: "V1",
                createdAt: "",
                creator: { id: creatorId }
            });
        const deliverVersion = async () =>
            deliver(
                // What the payload names is not trusted; the token's subject is.
                {
                    event: WebhookEvent.CREATE_VERSION,
                    documentId: "elsewhere",
                    versionId: "v-1"
                },
                await registered(WebhookSubject.DOCUMENT, DOCUMENT)
            );

        it("loads the document's groups as whoever made the version", async () => {
            vi.spyOn(UserSessions, "getOwnerSession").mockResolvedValue(
                session("owner-session")
            );
            createdBy("maker");
            liveSessions({ maker: "maker-session" });
            const load = mockLoads();

            await deliverVersion();

            expect(load).toHaveBeenCalledWith(expect.anything(), [
                {
                    libraryId: TEST_LIBRARY_ID,
                    groupId: TEST_GROUP_ID,
                    sessionId: "maker-session",
                    forceReload: false,
                    origin: "http://localhost"
                }
            ]);
        });

        it("falls back to the owner when the creator's session is gone", async () => {
            vi.spyOn(UserSessions, "getOwnerSession").mockResolvedValue(
                session("owner-session")
            );
            createdBy("maker");
            liveSessions({});
            const load = mockLoads();

            await deliverVersion();

            expect(loadedAs(load)).toEqual(["owner-session"]);
        });

        // Someone has to be able to read the version to learn who made it.
        it("reads the version as an admin when the owner's session is gone", async () => {
            vi.spyOn(UserSessions, "getOwnerSession").mockResolvedValue(
                undefined
            );
            await db.insert(adminTeamMembers).values({
                libraryId: TEST_LIBRARY_ID,
                userId: "admin",
                isTeamAdmin: true
            });
            createdBy("maker");
            liveSessions({ admin: "admin-session" });
            const load = mockLoads();

            await deliverVersion();

            expect(loadedAs(load)).toEqual(["admin-session"]);
        });

        it("flags the groups for a reload when no session works", async () => {
            vi.spyOn(UserSessions, "getOwnerSession").mockResolvedValue(
                undefined
            );
            const load = mockLoads();

            await deliverVersion();

            expect(load).not.toHaveBeenCalled();
            const group = await db
                .select({ buildIssues: groups.buildIssues })
                .from(groups)
                .where(eq(groups.id, TEST_GROUP_ID))
                .get();
            expect(group?.buildIssues).toContainEqual({
                type: BuildIssueType.VERSION_NOT_LOADED
            });
        });
    });

    describe("an admin team change", () => {
        beforeEach(async () => {
            await db
                .update(libraries)
                .set({ adminTeamId: "team" })
                .where(eq(libraries.id, TEST_LIBRARY_ID));
            vi.spyOn(UserSessions, "getOwnerSession").mockResolvedValue({
                sessionId: "owner-session",
                onshapeApi: new MockOnshapeApi()
            });
        });

        it("pulls the team again for each library it administers", async () => {
            const token = await registered(WebhookSubject.TEAM, "team");
            const sync = vi.spyOn(Sync, "syncAdminTeam").mockResolvedValue();

            await deliver(
                { event: WebhookEvent.TEAM_ADD_MEMBER, teamId: "team" },
                token
            );

            expect(sync).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                TEST_LIBRARY_ID
            );
        });

        // A team's webhook hears every team in the company.
        it("ignores another team's change", async () => {
            const token = await registered(WebhookSubject.TEAM, "team");
            const sync = vi.spyOn(Sync, "syncAdminTeam").mockResolvedValue();

            await deliver(
                { event: WebhookEvent.TEAM_REMOVE_MEMBER, teamId: "other" },
                token
            );

            expect(sync).not.toHaveBeenCalled();
        });
    });

    // So the next load of the document registers a new one.
    it("forgets a webhook Onshape dropped", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        await deliver({ event: WebhookEvent.UNREGISTER }, token);
        expect(await db.select().from(onshapeWebhooks).all()).toEqual([]);
    });
});
