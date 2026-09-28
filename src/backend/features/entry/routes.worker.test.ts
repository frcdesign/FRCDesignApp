import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { events } from "../analytics/schema";
import { EVENT_SCHEMA_VERSION, EventType } from "../analytics/usage";
import { LibraryId } from "../library/library-id";
import {
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedUser
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

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

describe("POST /app-open", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedUser(db);
    });

    it("records a versioned open in the library", async () => {
        const res = await createTestApp().request(
            `/api/app-open/library/${LibraryId.FTC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );

        expect(res.status).toBe(200);
        expect(await db.select().from(events).get()).toMatchObject({
            type: EventType.APP_OPEN,
            libraryId: LibraryId.FTC_DESIGN_LIB,
            userId: TEST_USER_ID,
            schemaVersion: EVENT_SCHEMA_VERSION
        });
    });

    it("records nothing for a caller who isn't signed in", async () => {
        const res = await createTestApp({
            isAuthenticated: false,
            signedIn: false
        }).request(
            `/api/app-open/library/${LibraryId.FTC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );

        expect(res.status).not.toBe(200);
        expect(await db.select().from(events).get()).toBeUndefined();
    });
});
