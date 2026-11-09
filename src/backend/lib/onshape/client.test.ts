import { describe, expect, it } from "vitest";
import {
    OnshapeApi,
    OnshapeApiError,
    OnshapeRateLimitError,
    OnshapeTimeoutError
} from "./client";

/** Minimal concrete client whose `_request` returns a canned response. */
class TestApi extends OnshapeApi {
    /** What the last call handed the transport, for asserting on the signal. */
    lastInit?: RequestInit;
    lastUrl?: string;

    constructor(private readonly response: Response) {
        super();
    }
    protected _request(
        _method: string,
        url: string,
        init: RequestInit
    ): Promise<Response> {
        this.lastInit = init;
        this.lastUrl = url;
        return Promise.resolve(this.response.clone());
    }
}

describe("OnshapeApi.send", () => {
    it("answers a failure instead of throwing, at the version asked for", async () => {
        const api = new TestApi(new Response("boom", { status: 429 }));
        const response = await api.send("GET", "/toolbar/tools", {
            version: 14
        });
        expect(response.status).toBe(429);
        expect(api.lastUrl).toBe(
            "https://cad.onshape.com/api/v14/toolbar/tools?"
        );
    });
});

describe("OnshapeApi error handling", () => {
    it("throws OnshapeRateLimitError with the Retry-After seconds on 429", async () => {
        const api = new TestApi(
            new Response("rate limited", {
                status: 429,
                headers: { "Retry-After": "450" }
            })
        );
        await expect(api.get("/x")).rejects.toMatchObject({
            name: "OnshapeRateLimitError",
            retryAfterSeconds: 450,
            status: 429
        });
    });

    it("falls back to a default when Retry-After is missing", async () => {
        const api = new TestApi(new Response("rate limited", { status: 429 }));
        await expect(api.get("/x")).rejects.toMatchObject({
            retryAfterSeconds: 60
        });
    });

    it("aborts a call that never answers", async () => {
        const api = new TestApi(new Response("{}"));
        await api.get("/x");
        expect(api.lastInit?.signal).toBeInstanceOf(AbortSignal);
        expect(api.lastInit?.signal?.aborted).toBe(false);
    });

    it("names a call that timed out", async () => {
        const api = new (class extends OnshapeApi {
            protected _request(): Promise<Response> {
                return Promise.reject(
                    new DOMException("timed out", "TimeoutError")
                );
            }
        })();
        await expect(api.get("/x")).rejects.toBeInstanceOf(OnshapeTimeoutError);
    });

    it("lets a caller's own signal win", async () => {
        const api = new TestApi(new Response("{}"));
        const controller = new AbortController();
        await api.get("/x", { signal: controller.signal });
        expect(api.lastInit?.signal).toBe(controller.signal);
    });

    it("throws a plain OnshapeApiError for non-429 failures", async () => {
        const api = new TestApi(new Response("boom", { status: 500 }));
        const request = api.get("/x");
        await expect(request).rejects.toBeInstanceOf(OnshapeApiError);
        await expect(request).rejects.not.toBeInstanceOf(OnshapeRateLimitError);
        await expect(request).rejects.toMatchObject({ status: 500 });
    });
});
