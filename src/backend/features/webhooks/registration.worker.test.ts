import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { resetDb } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { onshapeWebhooks, WebhookSubject } from "../../db/schema";
import { OnshapeApiError } from "../../lib/onshape/client";
import { ensureWebhook, removeWebhook } from "./registration";

const db = getDb(env.DB);
const ORIGIN = "https://app.example.com";

function mockOnshape() {
    const onshapeApi = new MockOnshapeApi();
    vi.spyOn(onshapeApi, "get").mockResolvedValue({
        id: "owner",
        company: { id: "company" }
    });
    const post = vi
        .spyOn(onshapeApi, "post")
        .mockResolvedValue({ id: "new-webhook" });
    const remove = vi
        .spyOn(onshapeApi, "deleteNone")
        .mockResolvedValue(undefined);
    return { onshapeApi, post, remove };
}

const stored = () => db.select().from(onshapeWebhooks).all();

describe("registering webhooks", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("registers a document's for its new versions, delivered with its token", async () => {
        const { onshapeApi, post } = mockOnshape();

        await ensureWebhook(
            env,
            onshapeApi,
            WebhookSubject.DOCUMENT,
            "doc",
            ORIGIN
        );

        const [row] = await stored();
        expect(row.webhookId).toBe("new-webhook");
        expect(post).toHaveBeenCalledWith("/webhooks", {
            body: expect.objectContaining({
                documentId: "doc",
                events: ["onshape.model.lifecycle.createversion"],
                url: `${ORIGIN}/api/webhooks/onshape?token=${row.token}`,
                isTransient: false
            }) as unknown
        });
    });

    // Registered as never transient, so one on record is taken to stand.
    it("registers nothing for a subject already registered", async () => {
        const { onshapeApi, post } = mockOnshape();
        await ensureWebhook(
            env,
            onshapeApi,
            WebhookSubject.DOCUMENT,
            "doc",
            ORIGIN
        );
        await ensureWebhook(
            env,
            onshapeApi,
            WebhookSubject.DOCUMENT,
            "doc",
            ORIGIN
        );
        expect(post).toHaveBeenCalledOnce();
    });

    it("removes one Onshape already dropped without complaint", async () => {
        const { onshapeApi, remove } = mockOnshape();
        await ensureWebhook(
            env,
            onshapeApi,
            WebhookSubject.DOCUMENT,
            "doc",
            ORIGIN
        );
        remove.mockRejectedValue(new OnshapeApiError("gone", 404));

        await removeWebhook(env, onshapeApi, WebhookSubject.DOCUMENT, "doc");

        expect(remove).toHaveBeenCalledWith("/webhooks/new-webhook");
        expect(await stored()).toEqual([]);
    });
});
