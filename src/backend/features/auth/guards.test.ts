import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { LibraryId } from "../library/library-id";
import { Theme } from "../settings/settings";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedLibrary
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("requireSignInMiddleware", () => {
    beforeEach(async () => {
        await resetDb(db);
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
            "/api/settings",
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
