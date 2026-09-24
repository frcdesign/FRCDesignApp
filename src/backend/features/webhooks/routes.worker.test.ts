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
import { onshapeWebhooks, WebhookSubject } from "../../db/schema";
import * as Jobs from "../load/jobs";
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

    // Nobody is signed in behind a webhook, so the load finds a session itself.
    it("loads the document's groups on a new version, with no session", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        const load = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

        await deliver(
            // What the payload names is not trusted; the token's subject is.
            { event: WebhookEvent.CREATE_VERSION, documentId: "elsewhere" },
            token
        );

        expect(load).toHaveBeenCalledWith(expect.anything(), [
            {
                libraryId: TEST_LIBRARY_ID,
                groupId: TEST_GROUP_ID,
                forceReload: false,
                origin: "http://localhost"
            }
        ]);
    });

    // So the next load of the document registers a new one.
    it("forgets a webhook Onshape dropped", async () => {
        const token = await registered(WebhookSubject.DOCUMENT, DOCUMENT);
        await deliver({ event: WebhookEvent.UNREGISTER }, token);
        expect(await db.select().from(onshapeWebhooks).all()).toEqual([]);
    });
});
