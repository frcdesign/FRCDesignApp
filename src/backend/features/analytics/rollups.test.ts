import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    TEST_USER_ID,
    resetDb,
    seedConfiguration,
    seedPartStudio
} from "../../../__test_utils__";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { getDb } from "../../db/client";
import { configurations } from "../../db/schema";
import { type AppContext } from "../../lib/context";
import { ElementType } from "../../lib/onshape/element-type";
import { toSelection } from "../configurations/selection";
import { InsertSource } from "./events";
import { rollupWrites } from "./rollups";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    events,
    insertableStats,
    userStats
} from "./schema";
import { trackAppOpen, trackInsert, type InsertEvent } from "./tracking";

const db = getDb(env.DB);
const SIZE_PARAMETERS = [enumParam("size", ["small", "large"])];

/** Every table the rollups write, read whole so a replay can be compared. */
const ROLLUPS = [
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyConfigurationMetrics,
    insertableStats,
    userStats
];

function fakeContext(): AppContext {
    return { env } as unknown as AppContext;
}

function insertEvent(overrides: Partial<InsertEvent> = {}): InsertEvent {
    return {
        libraryId: TEST_LIBRARY_ID,
        userId: TEST_USER_ID,
        path: TEST_PART_STUDIO_PATH,
        insertableId: TEST_PART_STUDIO_ID,
        targetElementType: ElementType.PART_STUDIO,
        selection: undefined,
        parameters: [],
        isFavorite: false,
        isQuickInsert: false,
        source: InsertSource.BROWSE,
        fasten: false,
        ...overrides
    };
}

async function readRollups(): Promise<unknown[][]> {
    return Promise.all(
        ROLLUPS.map(async (table) => {
            const rows = await db.select().from(table).all();
            return rows
                .map((row) => JSON.stringify(row))
                .sort((a, b) => a.localeCompare(b));
        })
    );
}

describe("rollupWrites", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
        await seedConfiguration(db);
        await db.update(configurations).set({ parameters: SIZE_PARAMETERS });
    });

    it("rebuilds every rollup from the log alone", async () => {
        // Two days, so the day keys have to come from the rows rather than now.
        const day = 24 * 3600 * 1000;
        const start = Date.parse("2026-03-01T09:00:00Z");
        const clock = vi.spyOn(Date, "now");

        clock.mockReturnValue(start);
        await trackAppOpen(fakeContext(), {
            libraryId: TEST_LIBRARY_ID,
            userId: TEST_USER_ID
        });
        await trackInsert(
            fakeContext(),
            insertEvent({
                selection: toSelection({}, SIZE_PARAMETERS),
                parameters: SIZE_PARAMETERS
            })
        );

        clock.mockReturnValue(start + day);
        await trackInsert(
            fakeContext(),
            insertEvent({
                selection: toSelection({ size: "large" }, SIZE_PARAMETERS),
                parameters: SIZE_PARAMETERS,
                targetElementType: ElementType.ASSEMBLY,
                isFavorite: true,
                isQuickInsert: true,
                source: InsertSource.FAVORITES,
                fasten: true
            })
        );
        await trackInsert(fakeContext(), insertEvent({ userId: "someone-2" }));
        clock.mockRestore();

        const live = await readRollups();
        expect(live.every((rows) => rows.length > 0)).toBe(true);

        // What a batch job would do: drop the rollups and derive them again
        // from the log. Replayed newest first, since nothing promises a job
        // reaches the rows in the order they were written.
        for (const table of ROLLUPS) {
            await db.delete(table);
        }
        const log = await db.select().from(events).all();
        const writes = log.reverse().flatMap((row) => rollupWrites(db, row));
        await db.batch([writes[0], ...writes.slice(1)]);

        expect(await readRollups()).toEqual(live);
    });
});
