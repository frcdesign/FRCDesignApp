import { createApp } from "../backend/create-app";
import { AccessLevel } from "../shared/access-level";
import { MOCK_ONSHAPE_API, MockOnshapeApi } from "./mock-onshape-api";

export interface TestAppOptions {
    /** Current user id, returned by `c.var.getUserId()` (default `"test-user"`). */
    userId?: string;
    /** Access level returned by `c.var.getAccessLevel()` (default `ADMIN`). */
    accessLevel?: AccessLevel;
    /** Onshape mock returned by `c.var.getOnshapeApi()` (default a fresh mock). */
    onshapeApi?: MockOnshapeApi;
    /**
     * When false, `getOnshapeApi` rejects so `isSignedIn()` is false (simulating
     * a not-signed-in caller). Default true.
     */
    signedIn?: boolean;
    /** Whether the caller passes the auth gate (default true). */
    isAuthenticated?: boolean;
}

/**
 * The real app from `createApp`, with Onshape, userId and access level mocked.
 * Drive it with `app.request(path, init, env)`.
 */
export function createTestApp(options: TestAppOptions = {}) {
    const signedIn = options.signedIn ?? true;
    return createApp(() => ({
        getOnshapeApi: () =>
            signedIn
                ? Promise.resolve(options.onshapeApi ?? MOCK_ONSHAPE_API)
                : Promise.reject(new Error("Not signed in")),
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
