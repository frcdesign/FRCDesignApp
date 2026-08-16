import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { users } from "../../shared/schema";
import { AccessLevel, Theme } from "../../shared/types";
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

    it("GET /access-data returns the caller's access level", async () => {
        await seedLibrary(db);
        await seedUser(db);
        const app = createTestApp({ accessLevel: AccessLevel.ADMIN });

        const res = await app.request(
            "/api/access-data",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        expect(await res.json()).toEqual({
            maxAccessLevel: AccessLevel.ADMIN,
            currentAccessLevel: AccessLevel.ADMIN
        });
        // Per-user, and Workers Cache keys ignore cookies.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("POST /user-data updates the user's settings", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/user-data",
            jsonRequest("POST", { theme: Theme.DARK }),
            env
        );
        expect(res.status).toBe(200);

        const row = await db
            .select()
            .from(users)
            .where(eq(users.id, TEST_USER_ID))
            .get();
        expect(row?.theme).toBe(Theme.DARK);
    });
});
