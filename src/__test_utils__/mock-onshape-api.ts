import { type OAuthApi } from "../backend/onshape-api/onshape-api";

export type OnshapeResponse = unknown;

/**
 * A test double for the Onshape API, used when a route under test calls
 * `c.var.getOnshapeApi()` and issues requests. Stub endpoints by path prefix with
 * {@link on}; any unstubbed call throws so missing stubs are obvious.
 *
 * Identity (userId) and access level are injected directly by `createTestApp`, so
 * they do not go through this mock.
 */
export class MockOnshapeApi {
    private readonly responses = new Map<string, OnshapeResponse>();

    /** Stubs the response returned for any request whose path starts with `path`. */
    on(path: string, response: OnshapeResponse): this {
        this.responses.set(path, response);
        return this;
    }

    private resolve(path: string): unknown {
        for (const [key, value] of this.responses) {
            if (path.startsWith(key)) {
                return typeof value === "function"
                    ? (value as (p: string) => unknown)(path)
                    : value;
            }
        }
        throw new Error(`MockOnshapeApi: unexpected request to "${path}"`);
    }

    get(path: string): Promise<any> {
        return Promise.resolve(this.resolve(path));
    }

    getRaw(path: string): Promise<Response> {
        return Promise.resolve(Response.json(this.resolve(path)));
    }

    getImage(): Promise<ArrayBuffer> {
        return Promise.resolve(new ArrayBuffer(0));
    }

    post(path: string): Promise<any> {
        return Promise.resolve(this.resolve(path));
    }

    postNone(): Promise<void> {
        return Promise.resolve();
    }

    delete(path: string): Promise<any> {
        return Promise.resolve(this.resolve(path));
    }

    deleteNone(): Promise<void> {
        return Promise.resolve();
    }

    /** Casts this mock to the {@link OAuthApi} type expected by the Hono context. */
    asOAuthApi(): OAuthApi {
        return this as unknown as OAuthApi;
    }
}
