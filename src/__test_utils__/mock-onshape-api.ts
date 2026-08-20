import { OAuthApi } from "@backend/lib/onshape/client";

/**
 * A thin shell client extending OAuthApi.
 */
export class MockOnshapeApi extends OAuthApi {
    constructor() {
        // The token/refresh callback are unused — requests never reach the network.
        super("mock-access-token", () => Promise.resolve("mock-access-token"));
    }

    protected _request(_method: string, url: string): Promise<Response> {
        return Promise.reject(
            new Error(`MockOnshapeApi: unexpected request to "${url}"`)
        );
    }
}

export const MOCK_ONSHAPE_API = new MockOnshapeApi();
