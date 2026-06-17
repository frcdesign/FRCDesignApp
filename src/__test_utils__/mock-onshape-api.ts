import { type OAuthApi } from "../backend/onshape-api/onshape-api";

export type OnshapeResponse = unknown;

export interface MockOnshapeApiOptions {
    /** The id returned from `users/sessioninfo` (i.e. the current user). */
    userId?: string;
}

/**
 * A test double for the Onshape API.
 *
 * The auth middleware resolves the current user via `getUserId()`, which calls
 * `users/sessioninfo` — this mock answers that with {@link userId}. Stub any
 * other endpoint a route calls with {@link on}; unstubbed calls throw.
 */
export class MockOnshapeApi {
    /** Id returned from `users/sessioninfo`. */
    userId: string;
    private readonly responses = new Map<string, OnshapeResponse>();

    constructor(options: MockOnshapeApiOptions = {}) {
        this.userId = options.userId ?? "test-user";
    }

    /** Stubs the response returned for any request whose path starts with `path`. */
    on(path: string, response: OnshapeResponse): this {
        this.responses.set(path, response);
        return this;
    }

    private resolve(path: string): unknown {
        if (path.includes("sessioninfo")) {
            return { id: this.userId };
        }
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
