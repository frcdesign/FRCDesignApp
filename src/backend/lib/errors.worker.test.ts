import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessLevel } from "../features/auth/access-level";
import { LibraryId } from "../features/library/library-id";
import { ApiErrorKind } from "./api-error";
import { createTestApp, jsonRequest, resetDb } from "../../__test_utils__";
import { getDb } from "../db/client";
import { OnshapeRateLimitError } from "./onshape/client";

const db = getDb(env.DB);

describe("api error responses", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Written for the user, and the kind tells the client what to offer them.
    it("marks a signed-out caller's refusal as needing a sign-in", async () => {
        const app = createTestApp({ signedIn: false });

        const res = await app.request(
            `/api/group-order/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );

        expect(res.status).toBe(401);
        expect(await res.json<unknown>()).toMatchObject({
            kind: ApiErrorKind.SIGN_IN_REQUIRED,
            message: expect.stringContaining("signed in")
        });
    });

    it("marks a caller without the access as forbidden", async () => {
        const app = createTestApp({ accessLevel: AccessLevel.USER });

        const res = await app.request(
            `/api/group-order/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );

        expect(res.status).toBe(403);
        expect(await res.json<unknown>()).toMatchObject({
            kind: ApiErrorKind.FORBIDDEN,
            message: expect.stringContaining("admin team")
        });
    });

    it("marks a rejected request as internal", async () => {
        const app = createTestApp({ accessLevel: AccessLevel.ADMIN });

        const res = await app.request(
            `/api/group-order/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST", { groupOrder: "not-an-array" }),
            env
        );

        expect(res.status).toBe(400);
        expect(await res.json<unknown>()).toMatchObject({
            kind: ApiErrorKind.INTERNAL
        });
    });

    it("logs an unexpected error under the request's Ray ID, and names it in the response", async () => {
        const logged = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const error = new Error("Failed query: select 1", {
            cause: new Error("D1_ERROR: no such table: favorites")
        });
        const app = createTestApp();
        app.post("/api/test-crash", () => {
            throw error;
        });

        const res = await app.request(
            "/api/test-crash",
            { method: "POST", headers: { "cf-ray": "8f00ba11-IAD" } },
            env
        );

        expect(res.status).toBe(500);
        expect(await res.json<unknown>()).toEqual({
            kind: ApiErrorKind.INTERNAL,
            message: "Internal Server Error",
            errorId: "8f00ba11-IAD"
        });
        // The message and its cause are spelled out: Workers Logs drops them from the stack.
        expect(logged).toHaveBeenCalledWith(
            "Server error 8f00ba11-IAD: Error: Failed query: select 1 <- Error: D1_ERROR: no such table: favorites",
            error
        );
    });

    it("names an Onshape rate limit's Ray ID and its wait, so a report finds the call and the client holds off", async () => {
        const logged = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const app = createTestApp();
        app.post("/api/test-limited", () => {
            throw new OnshapeRateLimitError("slow down", 86326, {
                method: "POST",
                path: "/assemblies/d/x/features"
            });
        });

        const res = await app.request(
            "/api/test-limited",
            { method: "POST", headers: { "cf-ray": "8f00ba11-IAD" } },
            env
        );

        expect(res.status).toBe(429);
        expect(await res.json<unknown>()).toEqual({
            kind: ApiErrorKind.HANDLED,
            message:
                "Onshape is limiting requests. Try again in about 24 hours.",
            retryAfterSeconds: 86326,
            errorId: "8f00ba11-IAD"
        });
        expect(logged).toHaveBeenCalledWith(
            expect.stringMatching(
                /^Onshape refused POST \/api\/test-limited \(8f00ba11-IAD\): .*retry after 86326s\) on POST \/assemblies\/d\/x\/features/
            )
        );
    });

    it("marks an unknown library as internal rather than explaining it", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/library-data/library/not-a-library?v=1",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(400);
        expect(await res.json<unknown>()).toMatchObject({
            kind: ApiErrorKind.INTERNAL
        });
    });
});
