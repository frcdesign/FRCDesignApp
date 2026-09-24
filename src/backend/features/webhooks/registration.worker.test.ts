import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { OnshapeApiError } from "../../lib/onshape/client";
import { ensureWebhook, getRegistration } from "./registration";

const ORIGIN = "https://app.example.com";
const OURS = `${ORIGIN}/api/webhooks/onshape?token=old`;

/**
 * Onshape, holding a webhook of this deployment's and one of another's. `ours`
 * is what asking after the recorded webhook answers, or undefined for gone.
 */
function mockOnshape(ours?: { url: string }) {
    const onshapeApi = new MockOnshapeApi();
    vi.spyOn(onshapeApi, "get").mockImplementation((path: string) => {
        if (path === "/users/sessioninfo") {
            return Promise.resolve({ id: "owner", company: { id: "company" } });
        }
        if (path.startsWith("/webhooks/")) {
            return ours
                ? Promise.resolve(ours)
                : Promise.reject(new OnshapeApiError("gone", 404));
        }
        return Promise.resolve({
            items: [
                { id: "stale", url: OURS },
                {
                    id: "theirs",
                    url: "https://cert.example.com/api/webhooks/onshape?token=x"
                }
            ]
        });
    });
    const post = vi
        .spyOn(onshapeApi, "post")
        .mockResolvedValue({ id: "new-webhook" });
    const remove = vi
        .spyOn(onshapeApi, "deleteNone")
        .mockResolvedValue(undefined);
    return { onshapeApi, post, remove };
}

describe("keeping the webhook registered", () => {
    beforeEach(async () => {
        await env.KV.delete("webhook-registration");
    });
    afterEach(() => vi.restoreAllMocks());

    it("registers one when none is on record, replacing this deployment's", async () => {
        const { onshapeApi, post, remove } = mockOnshape();

        await ensureWebhook(env, onshapeApi, ORIGIN);

        expect(remove).toHaveBeenCalledExactlyOnceWith("/webhooks/stale");
        const registration = await getRegistration(env);
        expect(registration?.webhookId).toBe("new-webhook");
        expect(post).toHaveBeenCalledWith(
            "/webhooks",
            expect.objectContaining({
                body: expect.objectContaining({
                    companyId: "company",
                    url: `${ORIGIN}/api/webhooks/onshape?token=${registration?.token}`,
                    isTransient: false
                })
            })
        );
    });

    it("leaves a registration that still stands alone", async () => {
        await env.KV.put(
            "webhook-registration",
            JSON.stringify({ token: "old", webhookId: "stale" })
        );
        const { onshapeApi, post } = mockOnshape({ url: OURS });

        await ensureWebhook(env, onshapeApi, ORIGIN);

        expect(post).not.toHaveBeenCalled();
    });

    it("registers again once Onshape no longer has the one on record", async () => {
        await env.KV.put(
            "webhook-registration",
            JSON.stringify({ token: "old", webhookId: "stale" })
        );
        const { onshapeApi, post } = mockOnshape();

        await ensureWebhook(env, onshapeApi, ORIGIN);

        expect(post).toHaveBeenCalledOnce();
    });
});
