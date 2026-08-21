import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
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

describe("requireEditorMiddleware", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    // Access level alone would admit a signed-out caller wherever it is
    // granted without a session, e.g. behind a dev ACCESS_LEVEL_OVERRIDE.
    it("401s an editor-level caller who is not signed in", async () => {
        const app = createTestApp({
            signedIn: false,
            accessLevel: AccessLevel.ADMIN
        });

        const res = await app.request(
            `/api/reload-groups/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );
        expect(res.status).toBe(401);
    });

    it("403s a signed-in caller without editor access", async () => {
        const app = createTestApp({
            signedIn: true,
            accessLevel: AccessLevel.USER
        });

        const res = await app.request(
            `/api/reload-groups/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );
        expect(res.status).toBe(403);
    });
});
