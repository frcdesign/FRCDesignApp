import { env } from "cloudflare:workers";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi
} from "vitest";
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
import { AccessLevel } from "../auth/access-level";
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

describe("the webhook probe", () => {
    const onshape = new MockOnshapeApi();
    let post: MockInstance<MockOnshapeApi["post"]>;
    const owner = () =>
        createTestApp({ accessLevel: AccessLevel.OWNER, onshapeApi: onshape });
    /** The body the probe sent Onshape on its first create. */
    const sentBody = () =>
        (post.mock.calls[0][1] as { body: Record<string, unknown> }).body;

    beforeEach(() => {
        post = vi.spyOn(onshape, "post");
    });
    afterEach(() => vi.restoreAllMocks());

    async function register(params: object = {}) {
        const res = await owner().request(
            "/api/webhook-probe",
            jsonRequest("POST", {
                events: ["onshape.team.addmember"],
                params
            }),
            env
        );
        return res.json<{ id: string; webhookId?: string; error?: string }>();
    }

    async function state() {
        const res = await owner().request(
            "/api/webhook-probe/state",
            jsonRequest("GET"),
            env
        );
        return res.json<{ id: string; deliveries: { body: unknown }[] }[]>();
    }

    it("registers the events and params asked for, pointed back at itself", async () => {
        post.mockResolvedValue({ id: "hook-1" });

        const answer = await register({ companyId: "company-1" });

        expect(answer.webhookId).toBe("hook-1");
        expect(post.mock.calls[0][0]).toBe("/webhooks");
        const body = sentBody();
        expect(body).toMatchObject({
            events: ["onshape.team.addmember"],
            companyId: "company-1",
            isTransient: true
        });
        expect(body.url).toContain(
            `/api/webhook-probe/deliveries?probe=${answer.id}&token=`
        );
    });

    it("keeps what Onshape sends, and turns away a delivery without its token", async () => {
        post.mockResolvedValue({ id: "hook-1" });
        const { id } = await register();
        const url = String(sentBody().url);
        const deliveryPath = new URL(url).pathname + new URL(url).search;

        const delivered = await createTestApp().request(
            deliveryPath,
            jsonRequest("POST", { event: "onshape.team.addmember" }),
            env
        );
        const forged = await createTestApp().request(
            `/api/webhook-probe/deliveries?probe=${id}&token=wrong`,
            jsonRequest("POST", { event: "forged" }),
            env
        );

        expect(delivered.status).toBe(200);
        expect(forged.status).toBe(403);
        const [probe] = await state();
        expect(probe.deliveries.map((each) => each.body)).toEqual([
            { event: "onshape.team.addmember" }
        ]);
    });

    it("shows Onshape's refusal", async () => {
        post.mockRejectedValue(new Error("no company"));
        expect((await register()).error).toContain("no company");
    });

    it("is a short way from /webhook", async () => {
        const res = await createTestApp().request("/webhook", {}, env);
        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe("/api/webhook-probe");
    });

    it("is the owner's alone", async () => {
        const res = await createTestApp().request(
            "/api/webhook-probe/state",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(403);
    });
});
