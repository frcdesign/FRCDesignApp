import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
import type {
    ConfigurationParameter,
    PartNumberMap
} from "../../shared/configuration-models";
import { ElementType } from "../../shared/types";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS,
    resetDb,
    seedGroup
} from "../../__test_utils__";
import { type ReloadedFields, saveInsertable } from "./load-insertable";
import type { InsertableToLoad } from "./load-utils";

const db = getDb(env.DB);

function element(overrides: Partial<InsertableToLoad> = {}): InsertableToLoad {
    return {
        insertableId: "ins-1",
        libraryId: TEST_LIBRARY_ID,
        groupId: TEST_GROUP_ID,
        path: {
            documentId: `doc-${TEST_GROUP_ID}`,
            instanceId: "inst-2",
            instanceType: "v",
            elementId: "elem-1"
        },
        name: "Element",
        elementType: ElementType.PART_STUDIO,
        microversionId: "mv-1",
        sortOrder: 0,
        supportsFasten: false,
        searchPartNumbers: false,
        isVisible: true,
        ...overrides
    };
}

/** Applies the save the way loadInsertable's save step does. */
async function applySave(
    toLoad: InsertableToLoad,
    parameters: ConfigurationParameter[],
    partNumbers: PartNumberMap = {},
    defaultPartNumber: string | null = null
): Promise<void> {
    const reloaded: ReloadedFields = {
        name: toLoad.name,
        elementType: toLoad.elementType,
        microversionId: toLoad.microversionId,
        versionId: toLoad.path.instanceId,
        vendors: [],
        thumbnailUrls: null,
        fastenInfo: null,
        defaultPartNumber,
        buildIssues: []
    };
    await saveInsertable(db, toLoad, reloaded, { parameters, partNumbers });
}

describe("saveInsertable", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
    });

    it("creates the row and its configuration, and a replay converges", async () => {
        await applySave(element(), TEST_PARAMETERS);
        await applySave(element(), TEST_PARAMETERS);

        const rows = await db.select().from(insertables).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: "ins-1",
            groupId: TEST_GROUP_ID,
            elementId: "elem-1",
            microversionId: "mv-1",
            versionId: "inst-2"
        });

        const configs = await db.select().from(configurations).all();
        expect(configs).toHaveLength(1);
        expect(configs[0]).toMatchObject({
            id: "ins-1",
            parameters: TEST_PARAMETERS
        });
    });

    it("preserves user-owned fields when reloading an existing row", async () => {
        await applySave(element(), []);
        // The user hides the element and moves it before the next reload.
        await db
            .update(insertables)
            .set({ isVisible: false, sortOrder: 5 })
            .where(eq(insertables.id, "ins-1"));

        await applySave(
            element({
                name: "Renamed",
                microversionId: "mv-2",
                sortOrder: 0
            }),
            []
        );

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row).toMatchObject({
            name: "Renamed",
            microversionId: "mv-2",
            isVisible: false,
            sortOrder: 5
        });
    });

    it("drops the configuration row when the element no longer has one", async () => {
        await applySave(element(), TEST_PARAMETERS);
        await applySave(element(), []);

        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });

    it("writes the computed part numbers", async () => {
        await applySave(element({ searchPartNumbers: true }), TEST_PARAMETERS, {
            "PN-1": { p: "v1" },
            "PN-2": { p: "v2" }
        });

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row?.searchPartNumbers).toBe(true);

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, "ins-1"))
            .get();
        expect(config?.partNumbers).toEqual({
            "PN-1": { p: "v1" },
            "PN-2": { p: "v2" }
        });
    });

    it("stores the default part number for a non-configurable insertable", async () => {
        await applySave(
            element({ searchPartNumbers: true }),
            [],
            {},
            "PN-default"
        );

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row?.defaultPartNumber).toBe("PN-default");
    });

    // getPartNumberMap in library-data.ts reads these columns without
    // re-checking the flag, so a disabled insertable must leave them empty.
    it("leaves the part-number columns empty when the flag is off", async () => {
        await applySave(
            element({ searchPartNumbers: true }),
            TEST_PARAMETERS,
            { "PN-1": { p: "v1" } },
            null
        );
        await applySave(element({ searchPartNumbers: false }), TEST_PARAMETERS);

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row?.defaultPartNumber).toBeNull();

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, "ins-1"))
            .get();
        expect(config?.partNumbers).toEqual({});
    });
});
