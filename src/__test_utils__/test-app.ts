import { createApp } from "@backend/app";
import { AccessLevel } from "@backend/features/auth/access-level";
import type { LibraryId } from "@backend/features/library/library-id";
import { MOCK_ONSHAPE_API, MockOnshapeApi } from "./mock-onshape-api";

export interface TestAppOptions {
    /** Current user id, returned by `c.var.getUserId()` (default `"test-user"`). */
    userId?: string;
    /** Default `ADMIN`; a function sets it per library. */
    accessLevel?: AccessLevel | ((libraryId: LibraryId) => AccessLevel);
    /** Onshape mock returned by `c.var.getOnshapeApi()` (default a fresh mock). */
    onshapeApi?: MockOnshapeApi;
    /** When false, `getOnshapeApi` rejects, so `isSignedIn()` is false. Default true. */
    signedIn?: boolean;
    /** Whether the caller passes the auth gate (default true). */
    isAuthenticated?: boolean;
}

/** The real app, with auth from `options` instead of `productionAuth`. */
export function createTestApp(options: TestAppOptions = {}) {
    const signedIn = options.signedIn ?? true;
    return createApp(() => ({
        getOnshapeApi: () =>
            signedIn
                ? Promise.resolve(options.onshapeApi ?? MOCK_ONSHAPE_API)
                : Promise.reject(new Error("Not signed in")),
        getUserId: () => Promise.resolve(options.userId ?? "test-user"),
        getAccessLevel: (libraryId) => {
            const level = options.accessLevel ?? AccessLevel.ADMIN;
            return Promise.resolve(
                typeof level === "function" ? level(libraryId) : level
            );
        },
        isAuthenticated: () => Promise.resolve(options.isAuthenticated ?? true)
    }));
}

export function jsonRequest(method: string, body?: unknown): RequestInit {
    if (body === undefined) return { method };
    return {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
    };
}
