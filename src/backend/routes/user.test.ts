import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { users } from "../../shared/schema";
import { AccessLevel, LibraryId, Theme } from "../../shared/types";
import {
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedLibrary,
    seedUser
} from "../../__test_utils__";
import { getDb } from "../db";

const db = getDb(env.DB);

describe("user routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("GET /context-data returns access level and settings", async () => {
        await seedLibrary(db);
        await seedUser(db);
        const app = createTestApp({ accessLevel: AccessLevel.ADMIN });

        const res = await app.request(
            "/api/context-data",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toEqual({
            accessData: {
                maxAccessLevel: AccessLevel.ADMIN,
                currentAccessLevel: AccessLevel.ADMIN,
                cacheVersion: 0
            },
            settings: {
                theme: Theme.SYSTEM,
                libraryId: LibraryId.FRC_DESIGN_LIB
            },
            signedIn: true
        });
    });

    it("POST /user-data updates the user's settings", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/user-data",
            jsonRequest("POST", {
                theme: Theme.DARK,
                libraryId: LibraryId.MKCAD
            }),
            env
        );
        expect(res.status).toBe(200);

        const row = await db
            .select()
            .from(users)
            .where(eq(users.id, TEST_USER_ID))
            .get();
        expect(row?.theme).toBe(Theme.DARK);
        expect(row?.libraryId).toBe(LibraryId.MKCAD);
    });
});
