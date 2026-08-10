import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel, LibraryId, Theme } from "../../shared/types";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedLibrary
} from "../../__test_utils__";
import { getDb } from "../db";

const db = getDb(env.DB);

describe("not-signed-in access", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("GET /context-data returns defaults with signedIn: false", async () => {
        await seedLibrary(db);
        // accessLevel is injected as ADMIN, but the not-signed-in branch ignores
        // it and reports a plain USER so the read-only UI loads.
        const app = createTestApp({
            signedIn: false,
            accessLevel: AccessLevel.ADMIN
        });

        const res = await app.request(
            "/api/context-data",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            accessData: {
                maxAccessLevel: AccessLevel.USER,
                currentAccessLevel: AccessLevel.USER,
                cacheVersion: 0
            },
            settings: {
                theme: Theme.SYSTEM,
                libraryId: LibraryId.FRC_DESIGN_LIB
            },
            signedIn: false
        });
    });

    it("blocks sign-in-only routes with 401 when not signed in", async () => {
        const app = createTestApp({ signedIn: false });

        const favorites = await app.request(
            "/api/favorites/library/" + LibraryId.FRC_DESIGN_LIB,
            jsonRequest("GET"),
            env
        );
        expect(favorites.status).toBe(401);

        const userData = await app.request(
            "/api/user-data",
            jsonRequest("POST", { theme: Theme.DARK }),
            env
        );
        expect(userData.status).toBe(401);
    });

    it("allows sign-in-only routes when signed in", async () => {
        await seedLibrary(db);
        const app = createTestApp({ signedIn: true });

        const favorites = await app.request(
            "/api/favorites/library/" + LibraryId.FRC_DESIGN_LIB,
            jsonRequest("GET"),
            env
        );
        expect(favorites.status).toBe(200);
    });
});
