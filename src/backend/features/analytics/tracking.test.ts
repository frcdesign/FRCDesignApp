import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    configurationValueStats,
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

function insertEvent(
    configuration: Record<string, string> | undefined,
    overrides: Partial<InsertEvent> = {}
): InsertEvent {
    return {
        libraryId: TEST_LIBRARY_ID,
        userId: TEST_USER_ID,
        elementId,
        insertableId: TEST_PART_STUDIO_ID,
        targetElementType: ElementType.PART_STUDIO,
        configuration,
        isFavorite: false,
        isQuickInsert: false,
        source: InsertSource.BROWSE,
        fasten: false,
        ...overrides
    };
}

describe("tracking", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
    });

    describe("trackInsert", () => {
        it("writes a raw event and seeds every rollup", async () => {
            await trackInsert(fakeContext(), insertEvent({ size: "large" }));

            const event = await db.select().from(events).get();
            expect(event).toMatchObject({
                type: "insert",
                libraryId: TEST_LIBRARY_ID,
                userId: TEST_USER_ID,
                elementId,
                configuration: { size: "large" }
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
            await trackInsert(fakeContext(), insertEvent({ size: "large" }));
            await trackInsert(fakeContext(), insertEvent({ size: "large" }));
            await trackInsert(fakeContext(), insertEvent({ size: "small" }));

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

        it("counts each configuration value separately", async () => {
            await trackInsert(fakeContext(), insertEvent({ size: "large" }));
            await trackInsert(fakeContext(), insertEvent({ size: "large" }));
            await trackInsert(fakeContext(), insertEvent({ size: "small" }));

            const values = await db
                .select()
                .from(configurationValueStats)
                .where(
                    and(
                        eq(configurationValueStats.libraryId, TEST_LIBRARY_ID),
                        eq(configurationValueStats.elementId, elementId)
                    )
                )
                .all();

            const counts = Object.fromEntries(
                values.map((row) => [row.value, row.count])
            );
            expect(counts).toEqual({ large: 2, small: 1 });
        });

        it("records the stored defaults when the user chose nothing", async () => {
            await seedConfiguration(db);

            await trackInsert(fakeContext(), insertEvent(undefined));

            const values = await db
                .select()
                .from(configurationValueStats)
                .all();
            // TEST_PARAMETERS declares one boolean defaulting to "true".
            expect(values).toHaveLength(1);
            expect(values[0]).toMatchObject({
                parameterId: "boolean",
                value: "true",
                count: 1
            });
        });

        it("counts the flag subsets against the day's inserts", async () => {
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, { isFavorite: true, fasten: true })
            );
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, {
                    isFavorite: true,
                    isQuickInsert: true
                })
            );
            await trackInsert(fakeContext(), insertEvent(undefined));

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
                insertEvent(undefined, {
                    targetElementType: ElementType.ASSEMBLY,
                    fasten: true
                })
            );
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, {
                    targetElementType: ElementType.ASSEMBLY
                })
            );
            // A part-studio insert is never fasten-eligible, so it must not
            // dilute the denominator.
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, {
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
                insertEvent(undefined, { source: InsertSource.SEARCH })
            );
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, {
                    source: InsertSource.SEARCH,
                    isQuickInsert: true
                })
            );
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, { source: InsertSource.FAVORITES })
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
                insertEvent(undefined, {
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
            await trackInsert(fakeContext(), insertEvent(undefined));

            expect(
                await db.select().from(configurationValueStats).all()
            ).toEqual([]);
            const event = await db.select().from(events).get();
            expect(event?.configuration).toBeNull();
        });
    });

    describe("daily user activity", () => {
        it("writes one row per user per day however much they do", async () => {
            await trackInsert(fakeContext(), insertEvent(undefined));
            await trackInsert(fakeContext(), insertEvent(undefined));
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
            await trackInsert(fakeContext(), insertEvent(undefined));
            await trackInsert(
                fakeContext(),
                insertEvent(undefined, { userId: "someone-else" })
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
