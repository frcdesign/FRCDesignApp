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

describe("GET /auth/sign-out", () => {
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

describe("GET /auth/sign-in", () => {
    /** The route's response to a caller starting a sign-in. */
    function signIn(query: string, sessionId?: string, origin = "") {
        return createTestApp().request(
            `${origin}/auth/sign-in?redirectUrl=%2Finit&${query}`,
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

    /** The Onshape authorization url the route sends the caller to. */
    async function authorizationUrl(
        query: string,
        origin?: string
    ): Promise<URL> {
        const res = await signIn(query, undefined, origin);
        expect(res.status).toBe(302);
        return new URL(res.headers.get("Location")!);
    }

    it("names the callback on the host the sign-in came in on", async () => {
        const url = await authorizationUrl("");
        expect(url.searchParams.get("redirect_uri")).toBe(
            "http://localhost/auth/callback"
        );
    });

    // Onshape returns the caller to the redirect uri the sign-in named, which
    // is what lets two hosts share one OAuth app for the length of a cutover.
    it("names each host's own, not one host's for both", async () => {
        const url = await authorizationUrl("", "https://app.frcdesign.org");
        expect(url.searchParams.get("redirect_uri")).toBe(
            "https://app.frcdesign.org/auth/callback"
        );
    });

    it("scopes the sign-in to the enterprise that launched it", async () => {
        const url = await authorizationUrl("sessionCompanyId=company-1");
        expect(url.searchParams.get("company_id")).toBe("company-1");
    });

    // Onshape rejects "cad" as a company, which is what a non-enterprise user
    // arrives with.
    it("names no company for a personal account", async () => {
        const url = await authorizationUrl("sessionCompanyId=cad");
        expect(url.searchParams.has("company_id")).toBe(false);
    });

    it("names no company for a standalone sign-in", async () => {
        const url = await authorizationUrl("");
        expect(url.searchParams.has("company_id")).toBe(false);
    });

    // The gate sends a caller here whenever Onshape will not take their
    // session, so a sign-in they never finish must not sign them out of the one
    // they arrived with.
    it("leaves the session the caller arrived with alone", async () => {
        await seedSession("session-1");

        const res = await signIn("", "session-1");

        const setCookie = res.headers.get("Set-Cookie") ?? "";
        expect(setCookie).not.toContain(`${SESSION_COOKIE}=`);
        expect(await env.KV.get("tokens:session-1")).not.toBeNull();
    });
});
