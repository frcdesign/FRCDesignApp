import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { insertables, recentInserts } from "../../db/schema";
import { getDb } from "../../db/client";
import * as PartStudioEndpoints from "../../lib/onshape/endpoints/part-studios";
import { MAX_RECENTS, type RecentsData } from "./contract";
import { writeRecentInsert } from "./store";
import { InsertSource } from "../analytics/usage";
import { dailySourceMetrics } from "../analytics/schema";
import {
    TEST_ASSEMBLY_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS,
    TEST_PART_STUDIO_ID,
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedInsertable,
    seedPartStudio
} from "../../../__test_utils__";

const db = getDb(env.DB);
const recentsUrl = `/api/recents/library/${TEST_LIBRARY_ID}`;

const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

async function getRecents(userId = TEST_USER_ID): Promise<RecentsData> {
    const res = await createTestApp({ userId }).request(
        recentsUrl,
        jsonRequest("GET"),
        env
    );
    expect(res.status).toBe(200);
    return res.json();
}

function recentIds(data: RecentsData): string[] {
    return data.recents.map((recent) => recent.insertableId);
}

/** Written directly, at a time of the test's choosing, so the order is certain. */
function writeRecent(
    insertableId: string,
    insertedAt: number,
    userId = TEST_USER_ID
) {
    return writeRecentInsert(
        db,
        userId,
        {
            libraryId: TEST_LIBRARY_ID,
            insertableId,
            selection: undefined,
            parameters: []
        },
        new Date(insertedAt)
    );
}

describe("recents routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    afterEach(() => vi.restoreAllMocks());

    it("records an insert with the selection it applied", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        vi.spyOn(PartStudioEndpoints, "addPartStudioFeature").mockResolvedValue(
            { feature: { featureId: "feat-1" } }
        );

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                selection: { boolean: "false" }
            }),
            env
        );
        expect(res.status).toBe(200);

        const { recents } = await getRecents();
        expect(recents).toHaveLength(1);
        expect(recents[0]).toMatchObject({
            insertableId: TEST_PART_STUDIO_ID,
            selection: { boolean: "false" }
        });
        expect(recents[0].configurationKey).toBeTruthy();
    });

    it("records an insert from the list under its own source", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartStudioEndpoints, "addPartStudioFeature").mockResolvedValue(
            { feature: { featureId: "feat-1" } }
        );

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { targetPath, source: InsertSource.RECENTS }),
            env
        );
        expect(res.status).toBe(200);

        // The overview sums this rollup, and ends yesterday, so today's insert is read here.
        const rollup = await db
            .select()
            .from(dailySourceMetrics)
            .where(eq(dailySourceMetrics.source, InsertSource.RECENTS))
            .all();
        expect(rollup).toMatchObject([{ count: 1 }]);
    });

    it("moves an insertable inserted again to the front", async () => {
        await seedPartStudio(db);
        await seedAssembly(db);

        await writeRecent(TEST_PART_STUDIO_ID, 1000);
        await writeRecent(TEST_ASSEMBLY_ID, 2000);
        expect(recentIds(await getRecents())).toEqual([
            TEST_ASSEMBLY_ID,
            TEST_PART_STUDIO_ID
        ]);

        await writeRecent(TEST_PART_STUDIO_ID, 3000);
        expect(recentIds(await getRecents())).toEqual([
            TEST_PART_STUDIO_ID,
            TEST_ASSEMBLY_ID
        ]);
    });

    it("keeps the selection last inserted", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        const write = (value: string, at: number) =>
            writeRecentInsert(
                db,
                TEST_USER_ID,
                {
                    libraryId: TEST_LIBRARY_ID,
                    insertableId: TEST_PART_STUDIO_ID,
                    selection: { boolean: value },
                    parameters: TEST_PARAMETERS
                },
                new Date(at)
            );

        await write("false", 1000);
        await write("true", 2000);

        const { recents } = await getRecents();
        expect(recents).toHaveLength(1);
        expect(recents[0].selection).toEqual({ boolean: "true" });
    });

    it(`keeps only the ${MAX_RECENTS} most recent`, async () => {
        await seedPartStudio(db);
        const ids = Array.from(
            { length: MAX_RECENTS + 2 },
            (_, i) => `recent-${i}`
        );
        for (const [i, id] of ids.entries()) {
            await seedInsertable(db, { id, elementId: `element-${i}` });
            await writeRecent(id, i);
        }

        const stored = await db.select().from(recentInserts).all();
        expect(stored).toHaveLength(MAX_RECENTS);
        expect(recentIds(await getRecents())).toEqual(ids.slice(2).reverse());
    });

    it("shows each user only their own", async () => {
        await seedPartStudio(db);
        await seedAssembly(db);
        await writeRecent(TEST_PART_STUDIO_ID, 1000);
        await writeRecent(TEST_ASSEMBLY_ID, 1000, "someone-else");

        expect(recentIds(await getRecents())).toEqual([TEST_PART_STUDIO_ID]);
        expect(recentIds(await getRecents("someone-else"))).toEqual([
            TEST_ASSEMBLY_ID
        ]);
    });

    it("drops an insertable's recents when it is hidden", async () => {
        await seedPartStudio(db);
        await writeRecent(TEST_PART_STUDIO_ID, 1000);

        const res = await createTestApp().request(
            `/api/set-insertable-visibility/library/${TEST_LIBRARY_ID}`,
            jsonRequest("POST", {
                insertableIds: [TEST_PART_STUDIO_ID],
                isVisible: false
            }),
            env
        );
        expect(res.status).toBe(200);
        expect((await getRecents()).recents).toEqual([]);
    });

    it("drops an insertable's recents when it is deleted", async () => {
        await seedPartStudio(db);
        await writeRecent(TEST_PART_STUDIO_ID, 1000);
        await db
            .delete(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        expect(await db.select().from(recentInserts).all()).toEqual([]);
    });

    it("DELETE removes one of the caller's recents", async () => {
        await seedPartStudio(db);
        await seedAssembly(db);
        await writeRecent(TEST_PART_STUDIO_ID, 1000);
        await writeRecent(TEST_ASSEMBLY_ID, 2000);

        const res = await createTestApp().request(
            `${recentsUrl}/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("DELETE"),
            env
        );
        expect(res.status).toBe(200);
        expect(recentIds(await getRecents())).toEqual([TEST_PART_STUDIO_ID]);
    });

    it("requires sign-in", async () => {
        const res = await createTestApp({ signedIn: false }).request(
            recentsUrl,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(401);
    });
});
