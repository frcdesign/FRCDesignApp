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
    function signIn(query: string, sessionId?: string) {
        return createTestApp().request(
            `/auth/sign-in?redirectUrl=%2Finit&${query}`,
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
    async function authorizationUrl(query: string): Promise<URL> {
        const res = await signIn(query);
        expect(res.status).toBe(302);
        return new URL(res.headers.get("Location")!);
    }

    // Named by neither half of the flow, so Onshape returns the caller to
    // whichever redirect url its OAuth app registers — which is why a host
    // wants an app of its own.
    it("names no callback, leaving it to the OAuth app", async () => {
        const url = await authorizationUrl("");
        expect(url.searchParams.get("redirect_uri")).toBeNull();
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

const LOGIN_COOKIE = "frc-design-app-login";

/**
 * Where the callback would send the caller: what the sign-in stored, which
 * `doCallback` redirects to unread.
 */
describe("GET /auth/sign-in redirect target", () => {
    async function storedRedirect(query: string): Promise<string | undefined> {
        const res = await createTestApp().request(
            `/auth/sign-in?${query}`,
            { method: "GET", redirect: "manual" },
            env
        );
        if (res.status !== 302) return undefined;

        const loginId = new RegExp(`${LOGIN_COOKIE}=([^;]+)`).exec(
            res.headers.get("Set-Cookie") ?? ""
        )?.[1];
        expect(loginId).toBeDefined();
        const raw = await env.KV.get(`login-session:${loginId!}`);
        return (JSON.parse(raw!) as { redirectUrl: string }).redirectUrl;
    }

    it("returns the caller to the launch /init named", async () => {
        expect(
            await storedRedirect("redirectUrl=%2Finit%3FdocumentId%3Ddoc-1")
        ).toBe("/init?documentId=doc-1");
    });

    // Onshape's own value names Onshape, and an enterprise is a subdomain.
    it("takes an Onshape url from Onshape", async () => {
        expect(
            await storedRedirect(
                "redirectOnshapeUri=https%3A%2F%2Fcompany.onshape.com%2Fdocuments%2Fdoc-1"
            )
        ).toBe("https://company.onshape.com/documents/doc-1");
    });

    // Ours carries the element the panel was opened on; Onshape's does not.
    it("prefers the launch over Onshape's own value", async () => {
        expect(
            await storedRedirect(
                "redirectUrl=%2Finit%3FdocumentId%3Ddoc-1&redirectOnshapeUri=https%3A%2F%2Fcad.onshape.com%2Fdocuments"
            )
        ).toBe("/init?documentId=doc-1");
    });

    // The reported bug: resolved against this origin it is a url with no route,
    // and the caller lands on the app's not-found page with no way back into
    // the document they came from.
    it("refuses a bare path, which would resolve against this app", async () => {
        expect(
            await storedRedirect(
                "redirectOnshapeUri=%2Fdocuments%2Fdoc-1%2Fw%2Fws-1%2Fe%2Fel-1"
            )
        ).toBe("/init");
    });

    it("refuses an origin that is not Onshape", async () => {
        expect(
            await storedRedirect(
                "redirectOnshapeUri=https%3A%2F%2Fevil.com%2Fx"
            )
        ).toBe("/init");
        // A host that merely ends in the zone's spelling is not in it.
        expect(
            await storedRedirect(
                "redirectOnshapeUri=https%3A%2F%2Fnotonshape.com%2Fx"
            )
        ).toBe("/init");
    });

    // Refusing outright would leave a caller unable to sign in at all if this
    // reading of what Onshape sends turns out to be too narrow.
    it("opens the app rather than refusing a value it cannot place", async () => {
        expect(await storedRedirect("redirectOnshapeUri=not-a-url")).toBe(
            "/init"
        );
    });

    it("refuses a protocol-relative url, which names another host", async () => {
        expect(
            await storedRedirect("redirectUrl=%2F%2Fevil.com")
        ).toBeUndefined();
    });
});
