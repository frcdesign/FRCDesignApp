import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    resetDb,
    seedConfiguration,
    seedPartStudio
} from "../../../__test_utils__";
import {
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";
import { getDb } from "../../db/client";
import { configurations } from "../../db/schema";
import { ElementType } from "../../lib/onshape/element-type";
import {
    OptionVisibilityType,
    VisibilityType,
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { toSelection } from "../configurations/selection";
import { rebuildConfigurationMetrics } from "./rebuild";
import { dailyConfigurationMetrics, events } from "./schema";
import { EventType, EVENT_SCHEMA_VERSION, InsertSource } from "./usage";

const db = getDb(env.DB);
const elementId = TEST_PART_STUDIO_PATH.elementId;

/** A vendor, and a bearing list whose middle option both vendors offer. */
const PARAMETERS: ConfigurationParameter[] = [
    enumParam("vendor", ["generic", "wcp"]),
    enumParam("bearing", ["genericOnly", "shared", "wcpOnly"], {
        optionConditions: [
            {
                type: OptionVisibilityType.LIST,
                controlledOptions: ["genericOnly"],
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "vendor",
                    value: "generic"
                }
            },
            {
                type: OptionVisibilityType.LIST,
                controlledOptions: ["wcpOnly"],
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "vendor",
                    value: "wcp"
                }
            }
        ]
    })
];

/**
 * A logged insert, written straight to the log: the rebuild reads that alone,
 * and writing it here is what proves it does not lean on the rollup.
 */
async function logInsert(day: string, selection: Selection): Promise<void> {
    await db.insert(events).values({
        id: crypto.randomUUID(),
        type: EventType.INSERT,
        createdAt: new Date(`${day}T12:00:00Z`),
        day,
        libraryId: TEST_LIBRARY_ID,
        userId: "user-a",
        schemaVersion: EVENT_SCHEMA_VERSION,
        ...TEST_PART_STUDIO_PATH,
        insertableId: TEST_PART_STUDIO_ID,
        targetElementType: ElementType.PART_STUDIO,
        selection,
        isFavorite: false,
        isQuickInsert: false,
        source: InsertSource.BROWSE,
        fasten: false
    });
}

/**
 * One value's counts by the branch it was recorded under, summed over days:
 * the table keys a row per day, and the branch is what these tests are about.
 */
async function byBranch(value: string): Promise<Record<string, number>> {
    const rows = await db.select().from(dailyConfigurationMetrics).all();
    const counts: Record<string, number> = {};
    for (const row of rows) {
        if (row.value !== value) continue;
        counts[row.instanceKey] = (counts[row.instanceKey] ?? 0) + row.count;
    }
    return counts;
}

describe("rebuildConfigurationMetrics", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
        await seedConfiguration(db);
        await db.update(configurations).set({ parameters: PARAMETERS });
    });

    it("splits a shared option by the vendor each insert chose", async () => {
        const select = (values: Record<string, string>) =>
            toSelection(values, PARAMETERS);
        await logInsert(
            "2026-03-01",
            select({ vendor: "generic", bearing: "shared" })
        );
        await logInsert(
            "2026-03-01",
            select({ vendor: "wcp", bearing: "shared" })
        );
        await logInsert(
            "2026-03-02",
            select({ vendor: "wcp", bearing: "shared" })
        );

        const result = await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID);

        expect(result.events).toBe(3);
        expect(await byBranch("shared")).toEqual({
            "vendor=generic": 1,
            // Two days, so the same branch is two rows summing to two inserts.
            "vendor=wcp": 2
        });
    });

    it("attributes a row recorded before the branch was keyed", async () => {
        await logInsert(
            "2026-03-01",
            toSelection({ vendor: "wcp", bearing: "shared" }, PARAMETERS)
        );
        // What the migration leaves behind: the count, under no branch.
        await db.insert(dailyConfigurationMetrics).values({
            day: "2026-03-01",
            libraryId: TEST_LIBRARY_ID,
            elementId,
            parameterId: "bearing",
            value: "shared",
            instanceKey: "",
            count: 1
        });

        await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID);

        expect(await byBranch("shared")).toEqual({ "vendor=wcp": 1 });
    });

    it("lands on the same counts when the same range is replayed twice", async () => {
        await logInsert(
            "2026-03-01",
            toSelection({ vendor: "wcp", bearing: "shared" }, PARAMETERS)
        );

        await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID);
        const once = await byBranch("shared");
        await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID);

        expect(await byBranch("shared")).toEqual(once);
    });

    it("replays only the days a range names", async () => {
        await logInsert(
            "2026-03-01",
            toSelection({ vendor: "generic", bearing: "shared" }, PARAMETERS)
        );
        await logInsert(
            "2026-04-01",
            toSelection({ vendor: "wcp", bearing: "shared" }, PARAMETERS)
        );

        const result = await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID, {
            from: "2026-03-01",
            to: "2026-03-31"
        });

        expect(result.events).toBe(1);
        // April was outside the slice, so nothing of it was read or dropped.
        expect(await byBranch("shared")).toEqual({ "vendor=generic": 1 });
    });

    it("keys against no branch for a part that has left the library", async () => {
        await db
            .update(configurations)
            .set({ parameters: [quantityParam("x")] });
        await logInsert(
            "2026-03-01",
            toSelection({ vendor: "wcp", bearing: "shared" }, PARAMETERS)
        );

        await rebuildConfigurationMetrics(db, TEST_LIBRARY_ID);

        // Nothing declares the bearing any more, so nothing says it had a branch.
        expect(await byBranch("shared")).toEqual({ "": 1 });
    });
});
