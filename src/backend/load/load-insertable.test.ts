import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
import type {
    ConfigurationParameter,
    ConfigurationRecord
} from "../../shared/configuration-models";
import { ElementType } from "../../shared/types";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS,
    resetDb,
    seedGroup
} from "../../__test_utils__";
import { type ParsedInsertable, saveInsertable } from "./load-insertable";
import type { InsertableTarget } from "./load-context";

const db = getDb(env.DB);

function element(overrides: Partial<InsertableTarget> = {}): InsertableTarget {
    return {
        insertableId: "ins-1",
        libraryId: TEST_LIBRARY_ID,
        groupId: TEST_GROUP_ID,
        elementPath: {
            documentId: `doc-${TEST_GROUP_ID}`,
            instanceId: "inst-2",
            instanceType: "v",
            elementId: "elem-1"
        },
        name: "Element",
        elementType: ElementType.PART_STUDIO,
        microversionId: "mv-1",
        sortOrder: 0,
        ...overrides
    };
}

/** Builds a configuration record with the given part number and defaults. */
function record(
    partNumber: string | null,
    configuration: Record<string, string> = {}
): ConfigurationRecord {
    return {
        configuration,
        partNumber,
        name: null,
        description: null,
        material: null,
        vendor: null,
        hasMultipleParts: false
    };
}

/** Applies the save the way loadInsertable's save step does. */
async function applySave(
    target: InsertableTarget,
    parameters: ConfigurationParameter[],
    records: ConfigurationRecord[] = []
): Promise<void> {
    const parsed: ParsedInsertable = {
        vendors: [],
        thumbnailUrls: null,
        fastenInfo: null,
        buildIssues: [],
        configuration: { parameters, records }
    };
    await saveInsertable(db, target, parsed);
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

    it("creates a new row hidden with its features off", async () => {
        await applySave(element(), []);

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row).toMatchObject({
            isVisible: false,
            supportsFasten: false,
            forceIndex: false
        });
    });

    it("preserves user-owned fields when reloading an existing row", async () => {
        await applySave(element(), []);
        // The user reveals the element, turns its features on, and moves it
        // before the next reload.
        await db
            .update(insertables)
            .set({
                isVisible: true,
                supportsFasten: true,
                forceIndex: true,
                sortOrder: 5
            })
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
            isVisible: true,
            supportsFasten: true,
            forceIndex: true,
            sortOrder: 5
        });
    });

    it("writes the computed configuration records", async () => {
        const records = [
            record("PN-1", { p: "v1" }),
            record("PN-2", { p: "v2" })
        ];
        await applySave(element(), TEST_PARAMETERS, records);

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, "ins-1"))
            .get();
        expect(config?.records).toEqual(records);
    });

    // An indexed insertable with no varying parameters still needs its records
    // stored, so a configurations row is kept even when `parameters` is empty.
    it("keeps a configuration row for a non-configurable indexed insertable", async () => {
        await applySave(element(), [], [record("PN-default")]);

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, "ins-1"))
            .get();
        expect(config?.parameters).toEqual([]);
        expect(config?.records).toEqual([record("PN-default")]);
    });

    // library-data reads `records` off the row without re-checking whether the
    // insertable is still indexed, so a reload with neither parameters nor
    // records must drop the row rather than leave stale records behind.
    it("drops the configuration row when there are no parameters or records", async () => {
        await applySave(element(), TEST_PARAMETERS, [record("PN-1")]);
        await applySave(element(), []);

        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });
});
