import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { favorites, groups, insertables } from "../../shared/schema";
import { AccessLevel } from "../../shared/types";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup,
    seedTestData
} from "../../__test_utils__";
import { getDb } from "../db";

const db = getDb(env.DB);
const adminApp = () => createTestApp({ accessLevel: AccessLevel.ADMIN });

describe("group admin routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("POST /set-element-visibility hides an insertable and drops its favorites", async () => {
        await seedTestData(db);

        const res = await adminApp().request(
            `/api/set-element-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                insertableIds: [TEST_PART_STUDIO_ID],
                isVisible: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const insertable = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID))
            .get();
        expect(insertable?.isVisible).toBe(false);

        const remaining = await db
            .select()
            .from(favorites)
            .where(eq(favorites.insertableId, TEST_PART_STUDIO_ID))
            .all();
        expect(remaining).toHaveLength(0);
    });

    it("POST /set-element-visibility is forbidden without admin access", async () => {
        await seedTestData(db);
        const res = await createTestApp().request(
            `/api/set-element-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                insertableIds: [TEST_PART_STUDIO_ID],
                isVisible: false
            }),
            env
        );
        expect(res.status).toBe(403);
    });

    it("POST /sort-group-alphabetically updates the flag", async () => {
        await seedTestData(db);

        const res = await adminApp().request(
            `/api/sort-group-alphabetically/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                groupId: TEST_GROUP_ID,
                sortAlphabetically: true
            }),
            env
        );
        expect(res.status).toBe(200);

        const group = await db
            .select()
            .from(groups)
            .where(eq(groups.id, TEST_GROUP_ID))
            .get();
        expect(group?.sortAlphabetically).toBe(true);
    });

    it("POST /group-order reorders groups", async () => {
        await seedTestData(db);
        await seedGroup(db, "test-group-2");

        const res = await adminApp().request(
            `/api/group-order/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                groupOrder: ["test-group-2", TEST_GROUP_ID]
            }),
            env
        );
        expect(res.status).toBe(200);

        const rows = await db
            .select()
            .from(groups)
            .orderBy(asc(groups.sortOrder))
            .all();
        expect(rows.map((r) => r.id)).toEqual(["test-group-2", TEST_GROUP_ID]);
    });

    it("DELETE /group removes the group and cascades to its insertables", async () => {
        await seedTestData(db);

        const res = await adminApp().request(
            `/api/group/library/${TEST_LIBRARY_ID}?groupId=${TEST_GROUP_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(res.status).toBe(200);

        expect(await db.select().from(groups).all()).toHaveLength(0);
        expect(await db.select().from(insertables).all()).toHaveLength(0);
    });
});
