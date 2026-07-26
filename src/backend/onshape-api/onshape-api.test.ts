import { describe, expect, it } from "vitest";
import {
    OnshapeApi,
    OnshapeApiError,
    OnshapeRateLimitError
} from "./onshape-api";

/** Minimal concrete client whose `_request` returns a canned response. */
class TestApi extends OnshapeApi {
    constructor(private readonly response: Response) {
        super();
    }
    protected _request(): Promise<Response> {
        return Promise.resolve(this.response.clone());
    }
}

describe("OnshapeApi._call rate limiting", () => {
    it("throws OnshapeRateLimitError with the Retry-After seconds on 429", async () => {
        const api = new TestApi(
            new Response("rate limited", {
                status: 429,
                headers: {
                    "Retry-After": "450",
                    "X-Rate-Limit-Remaining": "0"
                }
            })
        );
        await expect(api.get("/x")).rejects.toMatchObject({
            name: "OnshapeRateLimitError",
            retryAfterSeconds: 450,
            status: 429
        });
        expect(api.lastRateLimitRemaining).toBe(0);
    });

    it("falls back to a default when Retry-After is missing", async () => {
        const api = new TestApi(new Response("rate limited", { status: 429 }));
        await expect(api.get("/x")).rejects.toMatchObject({
            retryAfterSeconds: 60
        });
    });

    it("throws a plain OnshapeApiError for non-429 failures", async () => {
        const api = new TestApi(new Response("boom", { status: 500 }));
        const error = await api.get("/x").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(OnshapeApiError);
        expect(error).not.toBeInstanceOf(OnshapeRateLimitError);
        expect((error as OnshapeApiError).status).toBe(500);
    });

    it("records X-Rate-Limit-Remaining from a successful response", async () => {
        const api = new TestApi(
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "X-Rate-Limit-Remaining": "42" }
            })
        );
        await api.get("/x");
        expect(api.lastRateLimitRemaining).toBe(42);
    });
});
