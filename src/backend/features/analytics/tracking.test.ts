import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    configurations,
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    events,
    insertableStats,
    userStats
} from "../../db/schema";
import {
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    TEST_USER_ID,
    resetDb,
    seedConfiguration,
    seedPartStudio
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { type AppContext } from "../../lib/context";
import {
    toDayKey,
    trackAppOpen,
    trackInBackground,
    trackInsert,
    type InsertEvent
} from "./tracking";
import { InsertSource } from "./events";
import {
    boolParam,
    enumParam,
    quantityParam
} from "../../../__test_utils__/configuration-fixtures";
import {
    VisibilityType,
    type ConfigurationParameter
} from "../configurations/models";
import { toSelection } from "../configurations/selection";
import { ElementType } from "../../lib/onshape/element-type";

const db = getDb(env.DB);

/** Silences an expected console.error without an empty arrow. */
function noop(): void {
    return;
}
const elementId = TEST_PART_STUDIO_PATH.elementId;

/** A context stub carrying only what the tracking functions touch. */
function fakeContext(): AppContext {
    return { env } as unknown as AppContext;
}

/** An insert of an unconfigurable part. */
function insertEvent(overrides: Partial<InsertEvent> = {}): InsertEvent {
    return {
        libraryId: TEST_LIBRARY_ID,
        userId: TEST_USER_ID,
        elementId,
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

/** An enum, a length and a parameter only shown for the "large" size. */
const SIZE_PARAMETERS: ConfigurationParameter[] = [
    enumParam("size", ["small", "large"]),
    quantityParam("length"),
    {
        ...boolParam("reinforced"),
        condition: {
            type: VisibilityType.EQUAL,
            id: "size",
            value: "large"
        }
    }
];

/**
 * An insert of a configured part, whole against its parameters — which is what
 * the insert routes hand tracking.
 */
function configuredEvent(
    values: Record<string, string>,
    overrides: Partial<InsertEvent> = {}
): InsertEvent {
    return insertEvent({
        selection: toSelection(values, SIZE_PARAMETERS),
        parameters: SIZE_PARAMETERS,
        ...overrides
    });
}

async function seedSizeConfiguration() {
    await seedConfiguration(db);
    await db.update(configurations).set({ parameters: SIZE_PARAMETERS });
}

describe("tracking", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
    });

    describe("trackInsert", () => {
        it("writes a raw event and seeds every rollup", async () => {
            await seedSizeConfiguration();
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large" })
            );

            const event = await db.select().from(events).get();
            expect(event).toMatchObject({
                type: "insert",
                libraryId: TEST_LIBRARY_ID,
                userId: TEST_USER_ID,
                elementId,
                selection: { size: "large" }
            });
            expect(event?.day).toBe(toDayKey(Date.now()));

            const stats = await db.select().from(insertableStats).get();
            expect(stats?.insertCount).toBe(1);

            const daily = await db.select().from(dailyMetrics).get();
            expect(daily?.count).toBe(1);

            const user = await db.select().from(userStats).get();
            expect(user).toMatchObject({ insertCount: 1, openCount: 0 });
        });

        it("increments the rollups rather than duplicating rows", async () => {
            await seedSizeConfiguration();
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large" })
            );
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large" })
            );
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "small" })
            );

            const stats = await db.select().from(insertableStats).all();
            expect(stats).toHaveLength(1);
            expect(stats[0].insertCount).toBe(3);

            const daily = await db.select().from(dailyMetrics).all();
            expect(daily).toHaveLength(1);
            expect(daily[0].count).toBe(3);

            // The user is unique, so still one row — this is what makes the
            // unique-user count a cheap COUNT.
            const users = await db.select().from(userStats).all();
            expect(users).toHaveLength(1);
            expect(users[0].insertCount).toBe(3);

            expect(await db.select().from(events).all()).toHaveLength(3);
        });

        it("rolls the part's own day up, split by the tab it landed in", async () => {
            await trackInsert(fakeContext(), insertEvent());
            await trackInsert(
                fakeContext(),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY
                })
            );

            const daily = await db.select().from(dailyInsertableMetrics).all();
            expect(daily).toHaveLength(1);
            expect(daily[0]).toMatchObject({
                elementId,
                count: 2,
                partStudioCount: 1,
                assemblyCount: 1
            });
        });

        it("records a part's user once a day, however often they insert it", async () => {
            await trackInsert(fakeContext(), insertEvent());
            await trackInsert(fakeContext(), insertEvent());
            await trackInsert(
                fakeContext(),
                insertEvent({ userId: "someone-else" })
            );

            const rows = await db.select().from(dailyInsertableUsers).all();
            expect(rows).toHaveLength(2);
            expect(rows.map((row) => row.elementId)).toEqual([
                elementId,
                elementId
            ]);
        });

        it("counts each configuration value separately", async () => {
            await seedSizeConfiguration();
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large" })
            );
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large" })
            );
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "small" })
            );

            const values = await db
                .select()
                .from(dailyConfigurationMetrics)
                .where(
                    and(
                        eq(
                            dailyConfigurationMetrics.libraryId,
                            TEST_LIBRARY_ID
                        ),
                        eq(dailyConfigurationMetrics.elementId, elementId),
                        eq(dailyConfigurationMetrics.parameterId, "size")
                    )
                )
                .all();

            const counts = Object.fromEntries(
                values.map((row) => [row.value, row.count])
            );
            expect(counts).toEqual({ large: 2, small: 1 });
        });

        it("counts one value however the user spelled it", async () => {
            await seedSizeConfiguration();
            for (const length of ["1in", "1 in", "25.4 mm", "(0.5 + 0.5) in"]) {
                await trackInsert(fakeContext(), configuredEvent({ length }));
            }

            const values = await db
                .select()
                .from(dailyConfigurationMetrics)
                .where(eq(dailyConfigurationMetrics.parameterId, "length"))
                .all();

            expect(values).toHaveLength(1);
            expect(values[0]).toMatchObject({ value: "0.0254 m", count: 4 });
        });

        it("leaves out a parameter the selection hides", async () => {
            await seedSizeConfiguration();
            // "reinforced" is only shown for the large size, and Onshape
            // applies nothing it does not show.
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "small", reinforced: "true" })
            );
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large", reinforced: "true" })
            );

            const values = await db
                .select()
                .from(dailyConfigurationMetrics)
                .where(eq(dailyConfigurationMetrics.parameterId, "reinforced"))
                .all();

            expect(values).toHaveLength(1);
            expect(values[0]).toMatchObject({ value: "true", count: 1 });
        });

        it("ignores a value for a parameter the part does not declare", async () => {
            await seedSizeConfiguration();
            await trackInsert(
                fakeContext(),
                configuredEvent({ size: "large", removedLongAgo: "1" })
            );

            const values = await db
                .select()
                .from(dailyConfigurationMetrics)
                .all();
            // Every declared parameter the selection applies, and nothing else.
            expect(values.map((row) => row.parameterId).sort()).toEqual([
                "length",
                "reinforced",
                "size"
            ]);
        });

        // A quick insert chooses nothing, and the route hands over the whole
        // selection anyway — every parameter at its default.
        it("counts the defaults of a selection nobody touched", async () => {
            await seedSizeConfiguration();

            await trackInsert(fakeContext(), configuredEvent({}));

            const values = await db
                .select()
                .from(dailyConfigurationMetrics)
                .all();
            expect(
                Object.fromEntries(
                    values.map((row) => [row.parameterId, row.value])
                )
                // No "reinforced": the small default hides it, so it applied
                // nothing.
            ).toEqual({ size: "small", length: "0.0254 m" });
        });

        it("counts the flag subsets against the day's inserts", async () => {
            await trackInsert(
                fakeContext(),
                insertEvent({ isFavorite: true, fasten: true })
            );
            await trackInsert(
                fakeContext(),
                insertEvent({
                    isFavorite: true,
                    isQuickInsert: true
                })
            );
            await trackInsert(fakeContext(), insertEvent());

            const daily = await db.select().from(dailyMetrics).get();
            expect(daily).toMatchObject({
                count: 3,
                favoriteCount: 2,
                fastenCount: 1,
                quickInsertCount: 1
            });
        });

        it("counts assembly targets separately, as the fasten denominator", async () => {
            await trackInsert(
                fakeContext(),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY,
                    fasten: true
                })
            );
            await trackInsert(
                fakeContext(),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY
                })
            );
            // A part-studio insert is never fasten-eligible, so it must not
            // dilute the denominator.
            await trackInsert(
                fakeContext(),
                insertEvent({
                    targetElementType: ElementType.PART_STUDIO
                })
            );

            const daily = await db.select().from(dailyMetrics).get();
            expect(daily).toMatchObject({
                count: 3,
                assemblyCount: 2,
                fastenCount: 1
            });
        });

        it("splits inserts by source, tracking quick insert within each", async () => {
            await trackInsert(
                fakeContext(),
                insertEvent({ source: InsertSource.SEARCH })
            );
            await trackInsert(
                fakeContext(),
                insertEvent({
                    source: InsertSource.SEARCH,
                    isQuickInsert: true
                })
            );
            await trackInsert(
                fakeContext(),
                insertEvent({ source: InsertSource.FAVORITES })
            );

            const rows = await db.select().from(dailySourceMetrics).all();
            const bySource = Object.fromEntries(
                rows.map((row) => [
                    row.source,
                    { count: row.count, quick: row.quickInsertCount }
                ])
            );
            expect(bySource).toEqual({
                [InsertSource.SEARCH]: { count: 2, quick: 1 },
                [InsertSource.FAVORITES]: { count: 1, quick: 0 }
            });
        });

        it("keeps a favorited part inserted from search attributed to search", async () => {
            // isFavorite is a property of the part; source is where the insert
            // began. Conflating them would misreport the favorites list.
            await trackInsert(
                fakeContext(),
                insertEvent({
                    isFavorite: true,
                    source: InsertSource.SEARCH
                })
            );

            const event = await db.select().from(events).get();
            expect(event).toMatchObject({
                isFavorite: true,
                source: InsertSource.SEARCH
            });

            const rows = await db.select().from(dailySourceMetrics).all();
            expect(rows).toHaveLength(1);
            expect(rows[0].source).toBe(InsertSource.SEARCH);
        });

        it("records nothing extra for an insertable with no configuration", async () => {
            await trackInsert(fakeContext(), insertEvent());

            expect(
                await db.select().from(dailyConfigurationMetrics).all()
            ).toEqual([]);
            const event = await db.select().from(events).get();
            expect(event?.selection).toBeNull();
        });
    });

    describe("daily user activity", () => {
        it("writes one row per user per day however much they do", async () => {
            await trackInsert(fakeContext(), insertEvent());
            await trackInsert(fakeContext(), insertEvent());
            await trackAppOpen(fakeContext(), {
                libraryId: TEST_LIBRARY_ID,
                userId: TEST_USER_ID
            });

            const rows = await db.select().from(dailyUserActivity).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                libraryId: TEST_LIBRARY_ID,
                userId: TEST_USER_ID,
                day: toDayKey(Date.now())
            });
        });

        it("keeps a row per user", async () => {
            await trackInsert(fakeContext(), insertEvent());
            await trackInsert(
                fakeContext(),
                insertEvent({ userId: "someone-else" })
            );

            const rows = await db.select().from(dailyUserActivity).all();
            expect(rows.map((row) => row.userId).sort()).toEqual([
                "someone-else",
                TEST_USER_ID
            ]);
        });
    });

    describe("trackAppOpen", () => {
        it("counts opens separately from inserts", async () => {
            await trackAppOpen(fakeContext(), {
                libraryId: TEST_LIBRARY_ID,
                userId: TEST_USER_ID
            });

            const daily = await db.select().from(dailyMetrics).get();
            expect(daily).toMatchObject({ type: "app_open", count: 1 });

            const user = await db.select().from(userStats).get();
            expect(user).toMatchObject({ openCount: 1, insertCount: 0 });

            // An open isn't tied to a part.
            expect(await db.select().from(insertableStats).all()).toEqual([]);
        });
    });

    describe("trackInBackground", () => {
        it("swallows failures so an insert is never lost to tracking", async () => {
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(noop);

            await expect(
                trackInBackground(fakeContext(), () =>
                    Promise.reject(new Error("d1 exploded"))
                )
            ).resolves.toBeUndefined();

            expect(consoleError).toHaveBeenCalled();
            consoleError.mockRestore();
        });
    });
});
