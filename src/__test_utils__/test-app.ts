import { createApp } from "../backend/create-app";
import { AccessLevel } from "../shared/types";
import { MOCK_ONSHAPE_API, MockOnshapeApi } from "./mock-onshape-api";

export interface TestAppOptions {
    /** Current user id, returned by `c.var.getUserId()` (default `"test-user"`). */
    userId?: string;
    /** Access level returned by `c.var.getAccessLevel()` (default `ADMIN`). */
    accessLevel?: AccessLevel;
    /** Onshape mock returned by `c.var.getOnshapeApi()` (default a fresh mock). */
    onshapeApi?: MockOnshapeApi;
    /** Whether the caller passes the auth gate (default true). */
    isAuthenticated?: boolean;
}

/**
 * Builds the real Hono app via `createApp`, but with the Onshape API, userId, and
 * access level injected as mocks. Returns a plain Hono app — drive it with
 * `app.request(path, init, env)` (pass `env` from `cloudflare:workers`).
 */
export function createTestApp(options: TestAppOptions = {}) {
    return createApp(() => ({
        getOnshapeApi: () => Promise.resolve(MOCK_ONSHAPE_API),
        getUserId: () => Promise.resolve(options.userId ?? "test-user"),
        getAccessLevel: () =>
            Promise.resolve(options.accessLevel ?? AccessLevel.ADMIN),
        isAuthenticated: () => Promise.resolve(options.isAuthenticated ?? true)
    }));
}

/**
 * Builds a `RequestInit` for a JSON request, serializing `body` and setting the
 * content-type header. Use with `app.request(path, jsonRequest(...), env)`.
 */
export function jsonRequest(method: string, body?: unknown): RequestInit {
    if (body === undefined) return { method };
    return {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
    };
}
