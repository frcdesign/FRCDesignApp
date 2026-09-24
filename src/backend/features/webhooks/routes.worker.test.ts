import { env } from "cloudflare:workers";
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
import { AccessLevel } from "../auth/access-level";
import { accessLevelKey } from "../auth/session";
import { rememberOwnerSession } from "../auth/owner";
import * as JobTracker from "../load/job-tracker";
import { WebhookEvent } from "./registration";

const db = getDb(env.DB);
const TOKEN = "the-token";

/** Delivers a notification the way Onshape would, with `token` on the url. */
function deliver(body: object, token = TOKEN) {
    return createTestApp().request(
        `/api/webhooks/onshape?token=${token}`,
        jsonRequest("POST", body),
        env
    );
}

describe("receiving a webhook", () => {
    beforeEach(async () => {
        await resetDb(db);
        await env.KV.put(
            "webhook-registration",
            JSON.stringify({ token: TOKEN, webhookId: "ours" })
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("turns away a delivery without the registered token", async () => {
        const res = await deliver({ event: "webhook.ping" }, "guess");
        expect(res.status).toBe(403);
    });

    // Registration fails unless Onshape's own check is answered.
    it("answers Onshape's registration check", async () => {
        const res = await deliver({ event: "webhook.register" });
        expect(res.status).toBe(200);
    });

    // So the owner's next visit registers a new one.
    it("forgets a registration Onshape dropped", async () => {
        await deliver({ event: "webhook.unregister", webhookId: "ours" });
        expect(await env.KV.get("webhook-registration")).toBeNull();
    });

    describe("a new version", () => {
        beforeEach(async () => {
            await seedGroup(db, TEST_GROUP_ID);
            await rememberOwnerSession(env.KV, "owner-session");
            vi.spyOn(JobTracker, "trackJob").mockResolvedValue();
        });

        it("reloads the groups loaded from that document, as the owner", async () => {
            vi.spyOn(JobTracker, "isReloadRunning").mockResolvedValue(false);
            const create = vi
                .spyOn(env.LOAD_LIBRARY_WORKFLOW, "create")
                .mockResolvedValue({ id: "wf" } as never);

            await deliver({
                event: WebhookEvent.CREATE_VERSION,
                documentId: `doc-${TEST_GROUP_ID}`
            });

            expect(create.mock.calls[0][0]?.params).toEqual({
                libraryId: TEST_LIBRARY_ID,
                sessionId: "owner-session",
                documentIds: [`doc-${TEST_GROUP_ID}`]
            });
        });

        it("ignores a document no library holds", async () => {
            const create = vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "create");
            await deliver({
                event: WebhookEvent.CREATE_VERSION,
                documentId: "somebody-elses"
            });
            expect(create).not.toHaveBeenCalled();
        });

        // The running reload may have checked it before the version landed.
        it("queues the document behind a reload already running", async () => {
            vi.spyOn(JobTracker, "isReloadRunning").mockResolvedValue(true);
            const create = vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "create");

            await deliver({
                event: WebhookEvent.CREATE_VERSION,
                documentId: `doc-${TEST_GROUP_ID}`
            });

            expect(create).not.toHaveBeenCalled();
            expect(
                await env.KV.get(`queued-reload:${TEST_LIBRARY_ID}`, "json")
            ).toEqual([`doc-${TEST_GROUP_ID}`]);
        });
    });

    describe("an admin team change", () => {
        it("re-asks everyone's access level", async () => {
            await env.KV.put(accessLevelKey("someone"), AccessLevel.EDITOR);
            await deliver({
                event: WebhookEvent.TEAM_REMOVE_MEMBER,
                teamId: env.ADMIN_TEAM
            });
            expect(await env.KV.get(accessLevelKey("someone"))).toBeNull();
        });

        it("leaves access alone for any other team", async () => {
            await env.KV.put(accessLevelKey("someone"), AccessLevel.EDITOR);
            await deliver({
                event: WebhookEvent.TEAM_ADD_MEMBER,
                teamId: "another-team"
            });
            expect(await env.KV.get(accessLevelKey("someone"))).toBe(
                AccessLevel.EDITOR
            );
        });
    });
});
