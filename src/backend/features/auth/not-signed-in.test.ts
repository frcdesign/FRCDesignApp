import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
import { LibraryId } from "../library/library-id";
import { Theme } from "../users/settings";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedLibrary
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("not-signed-in access", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("GET /access-data reports signedIn: false when not signed in", async () => {
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
