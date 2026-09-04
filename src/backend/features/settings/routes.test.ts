import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { users } from "../../db/schema";

import { Theme } from "./settings";
import {
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    resetDb
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("settings routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("POST /settings updates the caller's settings", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/settings",
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

    it("POST /settings records and clears the open group", async () => {
        const app = createTestApp();
        const post = (body: unknown) =>
            app.request("/api/settings", jsonRequest("POST", body), env);
        const storedGroupId = async () =>
            (
                await db
                    .select()
                    .from(users)
                    .where(eq(users.id, TEST_USER_ID))
                    .get()
            )?.groupId;

        await post({ groupId: "group-1" });
        expect(await storedGroupId()).toBe("group-1");

        // Null is leaving the group, which is not the same as saying nothing.
        await post({ groupId: null });
        expect(await storedGroupId()).toBeNull();
    });
});
