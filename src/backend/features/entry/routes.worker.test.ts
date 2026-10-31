import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { events } from "../analytics/schema";
import { EVENT_SCHEMA_VERSION, EventType } from "../analytics/usage";
import {
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedUser
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import * as Permissions from "../../lib/onshape/endpoints/permissions";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import { OnshapeApiError } from "../../lib/onshape/client";
import { DocumentAccessProblem } from "./contract";

const db = getDb(env.DB);

describe("GET /init", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    // The app resumes the caller's tab from the browser's own storage.
    it("hands Onshape's launch to the app", async () => {
        const res = await createTestApp().request(
            "/init?documentId=doc&workspaceId=ws",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(302);
        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.pathname).toBe("/");
        expect(location.searchParams.get("documentId")).toBe("doc");
        expect(location.searchParams.get("workspaceId")).toBe("ws");
    });

    /** Where the gate sends a caller Onshape will not take. */
    async function signInRedirect(path: string): Promise<URL> {
        const res = await createTestApp({
            isAuthenticated: false,
            signedIn: false
        }).request(path, jsonRequest("GET"), env);

        expect(res.status).toBe(302);
        return new URL(res.headers.get("Location")!, "http://x");
    }

    it("signs in a caller Onshape will not take, scoped to their company", async () => {
        const location = await signInRedirect(
            "/init?sessionCompanyId=company-1"
        );

        expect(location.pathname).toBe("/auth/sign-in");
        expect(location.searchParams.get("sessionCompanyId")).toBe("company-1");
        const redirectUrl = new URL(
            location.searchParams.get("redirectUrl")!,
            "http://x"
        );
        expect(redirectUrl.pathname).toBe("/init");
        expect(redirectUrl.searchParams.get("sessionCompanyId")).toBe(
            "company-1"
        );
    });

    // There's no personal company to ask Onshape for, so this would loop.
    it("opens the app rather than signing a caller in twice", async () => {
        const location = await signInRedirect("/init");
        const res = await createTestApp({
            isAuthenticated: false,
            signedIn: false
        }).request(
            location.searchParams.get("redirectUrl")!,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(302);
        const entry = new URL(res.headers.get("Location")!, "http://x");
        expect(entry.pathname).toBe("/");
        // Spent, so it never reaches the app or a later sign-in.
        expect(entry.searchParams.has("signInAttempted")).toBe(false);
    });

    it("signs in a caller whose session is scoped to another company", async () => {
        const res = await createTestApp({ isAuthenticated: false }).request(
            "/init?sessionCompanyId=company-1",
            jsonRequest("GET"),
            env
        );

        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.pathname).toBe("/auth/sign-in");
    });

    // An enterprise session opening a personal document.
    it("signs in a caller whose session is for a company the document isn't", async () => {
        const res = await createTestApp({ isAuthenticated: false }).request(
            "/init",
            jsonRequest("GET"),
            env
        );

        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.pathname).toBe("/auth/sign-in");
    });

    it.each(["v", "m"])(
        "sends a launch in a %s instance to the version error",
        async (instanceType) => {
            const res = await createTestApp().request(
                `/init?documentId=doc&instanceType=${instanceType}`,
                jsonRequest("GET"),
                env
            );
            expect(res.headers.get("Location")).toBe("/version-error");
        }
    );

    it("never caches the gate's verdict", async () => {
        const res = await createTestApp().request(
            "/init",
            jsonRequest("GET"),
            env
        );
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });
});

describe("GET /init's document access check", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function grant(permissions: OnshapePermission[]) {
        vi.spyOn(Permissions, "getPermissions").mockResolvedValue(permissions);
    }

    async function launch(
        options: Parameters<typeof createTestApp>[0] = {}
    ): Promise<URL> {
        const res = await createTestApp(options).request(
            "/init?documentId=doc&instanceType=w&instanceId=ws&sessionCompanyId=company-1",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(302);
        return new URL(res.headers.get("Location")!, "http://x");
    }

    it("opens the app for a grant that can edit the document", async () => {
        grant([OnshapePermission.READ, OnshapePermission.WRITE]);

        expect((await launch()).pathname).toBe("/");
    });

    // A personal grant asked about an Enterprise's document, or the reverse.
    it("explains a grant that can't see the document", async () => {
        grant([]);

        const location = await launch();

        expect(location.pathname).toBe("/document-access");
        expect(location.searchParams.get("problem")).toBe(
            DocumentAccessProblem.WRONG_ACCOUNT
        );
        // The page goes back through /init, or on to the app, with these.
        expect(location.searchParams.get("documentId")).toBe("doc");
        expect(location.searchParams.get("sessionCompanyId")).toBe("company-1");
    });

    it("explains a grant that can't see the document after a sign-in", async () => {
        grant([]);

        const res = await createTestApp({ isAuthenticated: false }).request(
            "/init?documentId=doc&signInAttempted=1",
            jsonRequest("GET"),
            env
        );

        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.pathname).toBe("/document-access");
        expect(location.searchParams.has("signInAttempted")).toBe(false);
    });

    it("reads Onshape's 404 as a grant that can't see the document", async () => {
        vi.spyOn(Permissions, "getPermissions").mockRejectedValue(
            new OnshapeApiError("Not found", 404)
        );

        expect((await launch()).searchParams.get("problem")).toBe(
            DocumentAccessProblem.WRONG_ACCOUNT
        );
    });

    it("explains a document the caller can only view", async () => {
        grant([OnshapePermission.READ]);

        expect((await launch()).searchParams.get("problem")).toBe(
            DocumentAccessProblem.READ_ONLY
        );
    });

    it("opens the app when Onshape can't answer", async () => {
        vi.spyOn(Permissions, "getPermissions").mockRejectedValue(
            new OnshapeApiError("Unavailable", 503)
        );

        expect((await launch()).pathname).toBe("/");
    });

    it("leaves a caller with no session to the app's own sign-in", async () => {
        const getPermissions = vi.spyOn(Permissions, "getPermissions");

        const location = await launch({
            signedIn: false,
            isAuthenticated: false
        });

        // Sent to sign in first, not to the access page.
        expect(location.pathname).toBe("/auth/sign-in");
        expect(getPermissions).not.toHaveBeenCalled();
    });
});

describe("POST /app-open", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedUser(db);
    });

    it("records an open under no library", async () => {
        const res = await createTestApp().request(
            "/api/app-open",
            jsonRequest("POST"),
            env
        );

        expect(res.status).toBe(200);
        expect(await db.select().from(events).get()).toMatchObject({
            type: EventType.APP_OPEN,
            libraryId: null,
            userId: TEST_USER_ID,
            schemaVersion: EVENT_SCHEMA_VERSION
        });
    });

    it("records nothing for a caller who isn't signed in", async () => {
        const res = await createTestApp({
            isAuthenticated: false,
            signedIn: false
        }).request("/api/app-open", jsonRequest("POST"), env);

        expect(res.status).not.toBe(200);
        expect(await db.select().from(events).get()).toBeUndefined();
    });
});
