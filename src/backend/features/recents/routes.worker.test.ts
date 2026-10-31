import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { configurations, insertables, recentInserts } from "../../db/schema";
import { type ConfigurationParameter } from "../configurations/contract";
import { toSelection } from "../configurations/selection";
import { quantityParam } from "../../../__test_utils__/configuration-fixtures";
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

function writeConfigured(
    selection: Record<string, string>,
    insertedAt: number,
    parameters: ConfigurationParameter[] = TEST_PARAMETERS
) {
    return writeRecentInsert(
        db,
        TEST_USER_ID,
        {
            libraryId: TEST_LIBRARY_ID,
            insertableId: TEST_PART_STUDIO_ID,
            selection: toSelection(selection, parameters),
            parameters
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

    it("keeps each configuration of a part as its own row", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);

        await writeConfigured({ boolean: "false" }, 1000);
        await writeConfigured({ boolean: "true" }, 2000);

        const { recents } = await getRecents();
        expect(recents.map((recent) => recent.selection)).toEqual([
            { boolean: "true" },
            { boolean: "false" }
        ]);
    });

    it("moves a configuration inserted again to the front", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);

        await writeConfigured({ boolean: "false" }, 1000);
        await writeConfigured({ boolean: "true" }, 2000);
        await writeConfigured({ boolean: "false" }, 3000);

        const { recents } = await getRecents();
        expect(recents.map((recent) => recent.selection)).toEqual([
            { boolean: "false" },
            { boolean: "true" }
        ]);
    });

    it("treats one value typed two ways as one configuration", async () => {
        await seedPartStudio(db);
        const parameters = [quantityParam("length")];
        await db
            .insert(configurations)
            .values({ insertableId: TEST_PART_STUDIO_ID, parameters });

        await writeConfigured({ length: "5 in" }, 1000, parameters);
        await writeConfigured({ length: "(2 + 3) in" }, 2000, parameters);

        const { recents } = await getRecents();
        // Kept as it was typed last.
        expect(recents.map((recent) => recent.selection)).toEqual([
            { length: "(2 + 3) in" }
        ]);
    });

    it("shows one row for configurations a reload made the same", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        await writeConfigured({ boolean: "false" }, 1000);
        await writeConfigured({ boolean: "true" }, 2000);

        // The parameter that told them apart is gone.
        await db
            .update(configurations)
            .set({ parameters: [] })
            .where(eq(configurations.insertableId, TEST_PART_STUDIO_ID));

        expect(recentIds(await getRecents())).toEqual([TEST_PART_STUDIO_ID]);
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

    it("DELETE removes one configuration, leaving the part's others", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        await writeConfigured({ boolean: "false" }, 1000);
        await writeConfigured({ boolean: "true" }, 2000);
        const [newest] = (await getRecents()).recents;

        const res = await createTestApp().request(
            `/api/recent/${newest.id}`,
            jsonRequest("DELETE"),
            env
        );
        expect(res.status).toBe(200);

        const { recents } = await getRecents();
        expect(recents.map((recent) => recent.selection)).toEqual([
            { boolean: "false" }
        ]);
    });

    it("DELETE leaves another user's recent alone", async () => {
        await seedPartStudio(db);
        await writeRecent(TEST_PART_STUDIO_ID, 1000, "someone-else");
        const [theirs] = (await getRecents("someone-else")).recents;

        await createTestApp().request(
            `/api/recent/${theirs.id}`,
            jsonRequest("DELETE"),
            env
        );

        expect(recentIds(await getRecents("someone-else"))).toEqual([
            TEST_PART_STUDIO_ID
        ]);
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
