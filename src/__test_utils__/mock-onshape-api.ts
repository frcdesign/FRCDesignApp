import { OAuthApi } from "../backend/onshape-api/onshape-api";

/**
 * A test double for the Onshape API. It extends {@link OAuthApi} (so it is a real
 * `OAuthApi` with no casts) but intercepts every request in {@link _request}
 * instead of hitting the network.
 *
 * Used when a route under test calls `c.var.getOnshapeApi()` and issues requests:
 * stub endpoints by URL fragment with {@link on}; any unstubbed request rejects so
 * missing stubs are obvious. Identity (userId) and access level are injected
 * directly by `createTestApp`, so they do not go through this mock.
 */
export class MockOnshapeApi extends OAuthApi {
    private readonly responses = new Map<string, unknown>();

    constructor() {
        // The token/refresh callback are unused — requests never reach the network.
        super("mock-access-token", () => Promise.resolve("mock-access-token"));
    }

    /** Stubs the JSON response for any request whose URL contains `urlFragment`. */
    on(urlFragment: string, response: unknown): this {
        this.responses.set(urlFragment, response);
        return this;
    }

    protected _request(_method: string, url: string): Promise<Response> {
        for (const [fragment, value] of this.responses) {
            if (url.includes(fragment)) {
                return Promise.resolve(Response.json(value));
            }
        }
        return Promise.reject(
            new Error(`MockOnshapeApi: unexpected request to "${url}"`)
        );
    }
}
