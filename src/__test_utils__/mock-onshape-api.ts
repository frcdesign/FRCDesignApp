import { OAuthApi } from "../backend/onshape-api/onshape-api";

export const MOCK_SESSION_INFO = { id: "test-user", company: { id: "cad" } };

/**
 * A thin shell client extending OAuthApi. Only session info is answered, since
 * that is what the auth gate reads; anything else is an unexpected call.
 */
export class MockOnshapeApi extends OAuthApi {
    constructor() {
        // The token/refresh callback are unused — requests never reach the network.
        super("mock-access-token", () => Promise.resolve("mock-access-token"));
    }

    protected _request(_method: string, url: string): Promise<Response> {
        if (url.includes("sessioninfo")) {
            return Promise.resolve(Response.json(MOCK_SESSION_INFO));
        }
        return Promise.reject(
            new Error(`MockOnshapeApi: unexpected request to "${url}"`)
        );
    }
}

export const MOCK_ONSHAPE_API = new MockOnshapeApi();
