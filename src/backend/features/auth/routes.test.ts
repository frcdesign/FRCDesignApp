import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
import { createTestApp, jsonRequest, resetDb } from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("GET /access-data", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("returns the caller's access level", async () => {
        const app = createTestApp({ accessLevel: AccessLevel.EDITOR });

        const res = await app.request(
            "/api/access-data",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            maxAccessLevel: AccessLevel.EDITOR,
            signedIn: true
        });
    });

    it("reports signedIn: false when not signed in", async () => {
        const app = createTestApp({
            signedIn: false,
            accessLevel: AccessLevel.USER
        });

        const res = await app.request(
            "/api/access-data",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            maxAccessLevel: AccessLevel.USER,
            signedIn: false
        });
    });
});

describe("GET /auth/sign-out", () => {
    const SESSION_COOKIE = "frc-design-app-cookie";

    /** A signed-in session, as the OAuth callback would have left it. */
    async function seedSession(sessionId: string) {
        await env.KV.put(
            `tokens:${sessionId}`,
            JSON.stringify({
                accessToken: "a",
                refreshToken: "r",
                expiresAt: Date.now() + 10000
            })
        );
        await env.KV.put(`access-level:${sessionId}`, AccessLevel.ADMIN);
    }

    function signOut(redirectUrl: string, sessionId?: string) {
        return createTestApp().request(
            `/auth/sign-out?redirectUrl=${encodeURIComponent(redirectUrl)}`,
            {
                method: "GET",
                headers: sessionId
                    ? { Cookie: `${SESSION_COOKIE}=${sessionId}` }
                    : {},
                redirect: "manual"
            },
            env
        );
    }

    it("drops the session and everything keyed to it", async () => {
        await seedSession("session-1");

        const res = await signOut("/app/library/frc-design-lib", "session-1");

        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe("/app/library/frc-design-lib");
        expect(await env.KV.get("tokens:session-1")).toBeNull();
        expect(await env.KV.get("access-level:session-1")).toBeNull();
        expect(res.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE}=;`);
    });

    it("lands home rather than forwarding the caller offsite", async () => {
        for (const redirectUrl of ["https://example.com", "//example.com"]) {
            const res = await signOut(redirectUrl);
            expect(res.headers.get("Location")).toBe("/");
        }
    });

    it("signs out a caller who has no session to lose", async () => {
        const res = await signOut("/app");
        expect(res.status).toBe(302);
    });
});
