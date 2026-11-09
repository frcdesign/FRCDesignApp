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
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { AccessLevel } from "../auth/access-level";
import type { OnshapeCallBody, OnshapeCallResult } from "./contract";

/** Answers every call with `response`, recording what was asked. */
class CannedOnshapeApi extends MockOnshapeApi {
    calls: { method: string; url: string; body?: unknown }[] = [];

    constructor(private readonly response: () => Response) {
        super();
    }

    protected override _request(
        method: string,
        url: string,
        init?: RequestInit
    ): Promise<Response> {
        this.calls.push({
            method,
            url,
            body:
                typeof init?.body === "string"
                    ? (JSON.parse(init.body) as unknown)
                    : undefined
        });
        return Promise.resolve(this.response());
    }
}

function call(
    body: OnshapeCallBody,
    onshapeApi: MockOnshapeApi,
    accessLevel = AccessLevel.OWNER
) {
    return createTestApp({ onshapeApi, accessLevel }).request(
        "http://localhost/api/testbench/onshape",
        jsonRequest("POST", body),
        env
    );
}

describe("the testbench's Onshape calls", () => {
    afterEach(() => vi.restoreAllMocks());

    it("hands back a 429 with its headers instead of failing", async () => {
        const api = new CannedOnshapeApi(
            () =>
                new Response('{"message":"slow down"}', {
                    status: 429,
                    headers: {
                        "Retry-After": "30",
                        "X-Rate-Limit-Remaining": "0"
                    }
                })
        );

        const response = await call(
            {
                method: "DELETE",
                version: 14,
                path: "/toolbar/tools/u/user/delete",
                query: { a: "b" },
                body: { remove: ["tool"] }
            },
            api
        );

        expect(response.status).toBe(200);
        const result = await response.json<OnshapeCallResult>();
        expect(result).toMatchObject({
            status: 429,
            url: "https://cad.onshape.com/api/v14/toolbar/tools/u/user/delete?a=b",
            headers: { "retry-after": "30", "x-rate-limit-remaining": "0" },
            body: { message: "slow down" }
        });
        expect(api.calls).toEqual([
            {
                method: "DELETE",
                url: "https://cad.onshape.com/api/v14/toolbar/tools/u/user/delete?a=b",
                body: { remove: ["tool"] }
            }
        ]);
    });

    it("is the owner's alone", async () => {
        const api = new CannedOnshapeApi(() => new Response("{}"));

        const response = await call(
            { method: "GET", version: 17, path: "/users/sessioninfo" },
            api,
            AccessLevel.ADMIN
        );

        expect(response.status).toBe(403);
        expect(api.calls).toEqual([]);
    });

    it("stays on Onshape's API", async () => {
        const api = new CannedOnshapeApi(() => new Response("{}"));

        for (const path of ["/../../users", "users", "//evil.example.com/x"]) {
            const response = await call(
                { method: "GET", version: 17, path },
                api
            );
            expect(response.status).toBe(400);
        }
        expect(api.calls).toEqual([]);
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
            "/api/testbench/webhooks",
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
            "/api/testbench/webhooks",
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
            `/api/testbench/webhooks/deliveries?probe=${answer.id}&token=`
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
            `/api/testbench/webhooks/deliveries?probe=${id}&token=wrong`,
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

    it("is the owner's alone", async () => {
        const res = await createTestApp().request(
            "/api/testbench/webhooks",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(403);
    });
});
