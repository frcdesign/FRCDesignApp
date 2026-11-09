import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_GROUP_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { groups, onshapeWebhooks, WebhookSubject } from "../../db/schema";
import * as Jobs from "../load/jobs";
import * as Holds from "../load/holds";
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

    // Onshape deactivates a webhook whose deliveries error.
    it("answers 200 even when handling the delivery fails", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        vi.spyOn(Holds, "receiveNewVersion").mockRejectedValue(
            new Error("down")
        );
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const res = await deliver(
            { event: WebhookEvent.CREATE_VERSION },
            token
        );
        expect(res.status).toBe(200);
    });

    // Registration fails unless Onshape's own check is answered.
    it("answers Onshape's registration check", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        const res = await deliver({ event: "webhook.register" }, token);
        expect(res.status).toBe(200);
    });

    it("holds the document's groups for approval, loading nothing", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        await seedGroup(db, "other");
        const load = vi.spyOn(Jobs, "requestReload");

        await deliver(
            // What the payload names is not trusted; the token's subject is.
            { event: WebhookEvent.CREATE_VERSION, documentId: "doc-other" },
            token
        );

        const rows = await db
            .select({ id: groups.id, heldAt: groups.heldAt })
            .from(groups)
            .all();
        expect(rows).toEqual(
            expect.arrayContaining([
                { id: TEST_GROUP_ID, heldAt: expect.any(Date) },
                { id: "other", heldAt: null }
            ])
        );
        expect(load).not.toHaveBeenCalled();
    });

    // So the next load of the document registers a new one.
    it("forgets a webhook Onshape dropped", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        await deliver({ event: WebhookEvent.UNREGISTER }, token);
        expect(await db.select().from(onshapeWebhooks).all()).toEqual([]);
    });
});
