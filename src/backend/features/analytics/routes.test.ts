import { sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
    configurations,
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    insertables,
    insertableStats,
    userStats
} from "../../db/schema";
import {
    TEST_LIBRARY_ID,
    TEST_ASSEMBLY_PATH,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedFavorite,
    seedPartStudio,
    seedTestData
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { createApp } from "../../app";
import { EventType, InsertSource } from "./events";
import { quantityParam } from "../../../__test_utils__/configuration-fixtures";
import { LibraryId } from "../library/library-id";
import {
    ParameterType,
    type ConfigurationParameter
} from "../configurations/models";
import { ElementType } from "../../lib/onshape/element-type";
import {
    SPARKLINE_DAYS,
    type AnalyticsOverviewOut,
    type UnusedOptionOut,
    type InsertableReportOut,
    type LibraryHealthCounts,
    type LibrarySummary,
    type PartUsageOut
} from "./contract";
import { buildParameterUsage, summarizeHealth } from "./routes";
import { toDayKey } from "./tracking";
import { BuildIssueType } from "../build-checker/issues";

const db = getDb(env.DB);
const elementId = TEST_PART_STUDIO_PATH.elementId;

/**
 * Drives the real app with services that throw, exactly as they do for a
 * caller with no session. A read endpoint that touched `c.var.getUserId()` or
 * `getOnshapeApi()` would fail here — which is what keeps the dashboard public.
 */
function anonymousGet(path: string) {
    const app = createApp(() => ({
        getOnshapeApi: () => Promise.reject(new Error("no session")),
        getUserId: () => Promise.reject(new Error("no session")),
        getAccessLevel: () => Promise.reject(new Error("no session")),
        // Not a throw: an anonymous caller is simply not authenticated.
        isAuthenticated: () => Promise.resolve(false)
    }));
    return app.request(path, jsonRequest("GET"), env);
}

async function seedMetric(day: string, count: number, type = EventType.INSERT) {
    await db.insert(dailyMetrics).values({
        day,
        libraryId: TEST_LIBRARY_ID,
        type,
        count
    });
}

/** Wide enough to cover every day these tests seed. */
const ALL_TIME = "from=2000-01-01&to=2099-12-31";

interface SeedInsertOptions {
    day?: string;
    element?: string;
    userId?: string;
    /** The values chosen, counted once per insert. */
    configuration?: Record<string, string>;
    /** The tab the inserts landed in; left out of the split when absent. */
    target?: ElementType;
}

/**
 * The rollups `count` inserts of one part on one day would leave behind, which
 * is all any endpoint reads.
 */
async function seedInserts(
    count: number,
    options: SeedInsertOptions = {}
): Promise<void> {
    const {
        day = toDayKey(Date.now()),
        element = elementId,
        userId = "user-a",
        configuration = {},
        target
    } = options;
    const partStudio = target === ElementType.PART_STUDIO ? count : 0;
    const assembly = target === ElementType.ASSEMBLY ? count : 0;

    await db
        .insert(dailyInsertableMetrics)
        .values({
            day,
            libraryId: TEST_LIBRARY_ID,
            elementId: element,
            count,
            partStudioCount: partStudio,
            assemblyCount: assembly
        })
        .onConflictDoUpdate({
            target: [
                dailyInsertableMetrics.libraryId,
                dailyInsertableMetrics.elementId,
                dailyInsertableMetrics.day
            ],
            set: {
                count: sql`${dailyInsertableMetrics.count} + ${count}`,
                partStudioCount: sql`${dailyInsertableMetrics.partStudioCount} + ${partStudio}`,
                assemblyCount: sql`${dailyInsertableMetrics.assemblyCount} + ${assembly}`
            }
        });

    await db
        .insert(dailyInsertableUsers)
        .values({
            day,
            libraryId: TEST_LIBRARY_ID,
            elementId: element,
            userId
        })
        .onConflictDoNothing();

    for (const [parameterId, value] of Object.entries(configuration)) {
        await db
            .insert(dailyConfigurationMetrics)
            .values({
                day,
                libraryId: TEST_LIBRARY_ID,
                elementId: element,
                parameterId,
                value,
                count
            })
            .onConflictDoUpdate({
                target: [
                    dailyConfigurationMetrics.libraryId,
                    dailyConfigurationMetrics.elementId,
                    dailyConfigurationMetrics.parameterId,
                    dailyConfigurationMetrics.value,
                    dailyConfigurationMetrics.day
                ],
                set: {
                    count: sql`${dailyConfigurationMetrics.count} + ${count}`
                }
            });
    }
}

async function seedInsertableStats(count: number, insertedAt = Date.now()) {
    await db.insert(insertableStats).values({
        libraryId: TEST_LIBRARY_ID,
        elementId,
        insertCount: count,
        firstInsertedAt: insertedAt,
        lastInsertedAt: insertedAt
    });
}

describe("analytics routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    describe("public access", () => {
        it("serves every read endpoint without a session", async () => {
            await seedTestData(db);

            const paths = [
                "/api/analytics/overview",
                `/api/analytics/summary/library/${TEST_LIBRARY_ID}`,
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`,
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}`,
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`,
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}`
            ];

            for (const path of paths) {
                const res = await anonymousGet(path);
                expect(res.status, path).toBe(200);
            }
        });

        it("rejects an unknown library", async () => {
            const res = await anonymousGet("/api/analytics/parts/library/nope");
            expect(res.status).toBe(400);
        });
    });

    describe("GET /analytics/overview", () => {
        it("sums lifetime totals and counts unique users", async () => {
            await seedMetric("2026-01-01", 5);
            await seedMetric("2026-01-02", 3);
            await seedMetric("2026-01-02", 7, EventType.APP_OPEN);
            await db.insert(userStats).values([
                {
                    userId: "user-a",
                    libraryId: TEST_LIBRARY_ID,
                    firstSeenAt: 1,
                    lastSeenAt: 1
                },
                {
                    userId: "user-b",
                    libraryId: TEST_LIBRARY_ID,
                    firstSeenAt: 1,
                    lastSeenAt: 1
                },
                // Same person in a second library must not double-count.
                {
                    userId: "user-a",
                    libraryId: LibraryId.MKCAD,
                    firstSeenAt: 1,
                    lastSeenAt: 1
                }
            ]);

            const res = await anonymousGet("/api/analytics/overview");
            const body: AnalyticsOverviewOut = await res.json();

            expect(body.totals).toMatchObject({
                inserts: 8,
                appOpens: 7,
                uniqueUsers: 2
            });
        });

        it("returns the flag subsets that drive the percentages", async () => {
            await db.insert(dailyMetrics).values({
                day: "2026-03-01",
                libraryId: TEST_LIBRARY_ID,
                type: EventType.INSERT,
                count: 10,
                favoriteCount: 4,
                fastenCount: 3,
                quickInsertCount: 6,
                assemblyCount: 5
            });

            // Explicit range: the default window is the last 30 days, which
            // this fixed seed date falls outside of.
            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-03-01&to=2026-03-31"
            );
            const body: AnalyticsOverviewOut = await res.json();

            expect(body.totals).toMatchObject({
                inserts: 10,
                favoriteInserts: 4,
                fastenInserts: 3,
                quickInserts: 6,
                // The fasten denominator, so the UI reads 3/5 rather than 3/10.
                assemblyInserts: 5
            });
            expect(body.metricSeries[0]).toEqual({
                day: "2026-03-01",
                inserts: 10,
                appOpens: 0,
                activeUsers: 0,
                favoriteInserts: 4,
                fastenInserts: 3,
                quickInserts: 6,
                assemblyInserts: 5
            });
        });

        it("scopes rangeTotals to the range while totals stay lifetime", async () => {
            await seedMetric("2026-01-01", 5);
            await seedMetric("2026-06-15", 3);
            // Unique users over a range cannot come from user_stats, which
            // holds one all-time row per user, so it reads the per-day
            // activity rollup — never the event log.
            await db.insert(dailyUserActivity).values([
                {
                    day: "2026-01-01",
                    libraryId: TEST_LIBRARY_ID,
                    userId: "user-a"
                },
                {
                    day: "2026-06-15",
                    libraryId: TEST_LIBRARY_ID,
                    userId: "user-b"
                },
                {
                    day: "2026-06-16",
                    libraryId: TEST_LIBRARY_ID,
                    // Same person on two days in range counts once.
                    userId: "user-b"
                }
            ]);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-06-01&to=2026-06-30"
            );
            const body: AnalyticsOverviewOut = await res.json();

            expect(body.totals.inserts).toBe(8);
        });

        it("fills quiet days in, so an average is per calendar day", async () => {
            // Two active days inside a wider window. Left sparse, anything
            // dividing by the number of points would report the two-day
            // average and call it the month's.
            await seedMetric("2026-06-15", 2);
            await seedMetric("2026-06-18", 4);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-06-01&to=2026-06-20"
            );
            const body: AnalyticsOverviewOut = await res.json();

            // Clamped to the first recorded day, not back to the requested
            // one: "all time" reaches to 2000 and would fill two decades.
            expect(body.trackingSince).toBe("2026-06-15");
            expect(body.metricSeries.map((point) => point.day)).toEqual([
                "2026-06-15",
                "2026-06-16",
                "2026-06-17",
                "2026-06-18",
                "2026-06-19",
                "2026-06-20"
            ]);
            expect(body.metricSeries.map((point) => point.inserts)).toEqual([
                2, 0, 0, 4, 0, 0
            ]);
        });

        it("breaks inserts down by source, listing unused sources as zero", async () => {
            await db.insert(dailySourceMetrics).values([
                {
                    day: "2026-03-01",
                    libraryId: TEST_LIBRARY_ID,
                    source: InsertSource.SEARCH,
                    count: 7,
                    quickInsertCount: 2
                },
                {
                    day: "2026-03-02",
                    libraryId: TEST_LIBRARY_ID,
                    source: InsertSource.SEARCH,
                    count: 3,
                    quickInsertCount: 1
                },
                {
                    day: "2026-03-01",
                    libraryId: TEST_LIBRARY_ID,
                    source: InsertSource.FAVORITES,
                    count: 5,
                    quickInsertCount: 5
                }
            ]);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-03-01&to=2026-03-31"
            );
            const body: AnalyticsOverviewOut = await res.json();

            const bySource = Object.fromEntries(
                body.sources.map((row) => [row.source, row])
            );
            expect(bySource[InsertSource.SEARCH]).toMatchObject({
                count: 10,
                quickInsertCount: 3
            });
            expect(bySource[InsertSource.FAVORITES]).toMatchObject({
                count: 5,
                quickInsertCount: 5
            });
            // Present as a zero rather than missing, so the UI shows every source.
            expect(bySource[InsertSource.BROWSE]).toMatchObject({ count: 0 });
        });

        it("scopes the source breakdown to the range", async () => {
            await db.insert(dailySourceMetrics).values([
                {
                    day: "2026-03-01",
                    libraryId: TEST_LIBRARY_ID,
                    source: InsertSource.SEARCH,
                    count: 7,
                    quickInsertCount: 2
                },
                {
                    day: "2026-09-01",
                    libraryId: TEST_LIBRARY_ID,
                    source: InsertSource.SEARCH,
                    count: 100,
                    quickInsertCount: 50
                }
            ]);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-03-01&to=2026-03-31"
            );
            const body: AnalyticsOverviewOut = await res.json();

            const search = body.sources.find(
                (row) => row.source === InsertSource.SEARCH
            );
            expect(search).toMatchObject({ count: 7, quickInsertCount: 2 });
        });

        it("limits the series to the requested range", async () => {
            await seedMetric("2026-01-01", 1);
            await seedMetric("2026-06-01", 2);
            await seedMetric("2026-12-01", 4);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-05-01&to=2026-07-01"
            );
            const body: AnalyticsOverviewOut = await res.json();

            // Every day in the window is present, but only the one inside it
            // carries a count — days outside are excluded, not zeroed.
            expect(body.series).toHaveLength(62);
            expect(body.series[0].day).toBe("2026-05-01");
            expect(body.series.at(-1)?.day).toBe("2026-07-01");
            const withCounts = body.series.filter(
                (point) => Object.keys(point.counts).length > 0
            );
            expect(withCounts.map((point) => point.day)).toEqual([
                "2026-06-01"
            ]);
            // Totals stay lifetime, independent of the range.
            expect(body.totals.inserts).toBe(7);
        });
    });

    describe("GET /analytics/parts/library/:libraryId", () => {
        function partsUrl(query = `?${ALL_TIME}`) {
            return `/api/analytics/parts/library/${TEST_LIBRARY_ID}${query}`;
        }

        it("lists a visible part that has never been inserted", async () => {
            // The picker needs every part, not only the ones with history.
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({
                elementId,
                name: "Test PARTSTUDIO",
                insertCount: 0
            });
            // Enough to build both links the picker offers.
            expect(body[0].documentId).toBeTruthy();
            expect(body[0].versionId).toBeTruthy();
        });

        it("counts only inserts inside the window", async () => {
            await seedPartStudio(db);
            await seedInserts(3, { day: "2026-03-01" });
            await seedInserts(7, { day: "2025-03-01" });

            const inWindow = await anonymousGet(
                partsUrl("?from=2026-01-01&to=2026-12-31")
            );
            const allTime = await anonymousGet(partsUrl());

            const windowed: PartUsageOut[] = await inWindow.json();
            const lifetime: PartUsageOut[] = await allTime.json();
            expect(windowed[0].insertCount).toBe(3);
            expect(lifetime[0].insertCount).toBe(10);
        });

        it("still lists a part that went unused in the window", async () => {
            // Zero here means "not used lately", which is the interesting
            // reading — dropping the row would hide it.
            await seedPartStudio(db);
            await seedInserts(4, { day: "2025-03-01" });

            const res = await anonymousGet(
                partsUrl("?from=2026-01-01&to=2026-12-31")
            );
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0].insertCount).toBe(0);
            expect(body[0].usesPerMonth).toBe(0);
        });

        it("keeps history for a part that is no longer visible", async () => {
            // A hidden part is still in the library, so it stays listed with
            // whatever usage it accumulated while it was insertable.
            await seedPartStudio(db);
            await seedInserts(9);

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({ elementId, insertCount: 9 });
        });

        it("does not list a part twice", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedInserts(3);

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0].insertCount).toBe(3);
        });

        it("leaves out a part that is no longer in the library", async () => {
            await seedPartStudio(db);
            await seedInserts(9);
            // Usage with no insertable behind it: the tab was deleted. It would
            // otherwise top the table with a part nobody can open.
            await seedInserts(30, { element: "e-gone" });

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body.map((row) => row.elementId)).toEqual([elementId]);
            expect(body[0]).toMatchObject({
                name: "Test PARTSTUDIO",
                groupName: "Test Group",
                insertCount: 9
            });
        });

        it("ranks by rate, so a long-lived part does not coast on its total", async () => {
            const day = 24 * 3600 * 1000;
            const ago = (days: number) => toDayKey(Date.now() - days * day);
            await seedPartStudio(db);
            await seedAssembly(db);
            await db.update(insertables).set({ isVisible: true });
            // The part studio earned 60 over two years; the assembly earned 20
            // in the last two months and is the one in active use.
            await db.insert(insertableStats).values([
                {
                    libraryId: TEST_LIBRARY_ID,
                    elementId,
                    insertCount: 60,
                    firstInsertedAt: Date.now() - 730 * day,
                    lastInsertedAt: Date.now()
                },
                {
                    libraryId: TEST_LIBRARY_ID,
                    elementId: TEST_ASSEMBLY_PATH.elementId,
                    insertCount: 20,
                    firstInsertedAt: Date.now() - 60 * day,
                    lastInsertedAt: Date.now()
                }
            ]);
            await seedInserts(60, { day: ago(700) });
            await seedInserts(20, {
                day: ago(30),
                element: TEST_ASSEMBLY_PATH.elementId
            });

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body[0].elementId).toBe(TEST_ASSEMBLY_PATH.elementId);
            expect(body[0].usesPerMonth).toBeGreaterThan(body[1].usesPerMonth);
            // The window's total is still reported alongside the rate.
            expect(body.map((row) => row.insertCount)).toEqual([20, 60]);
        });

        it("rates a part over its own days, not the whole window", async () => {
            // Both parts were used 10 times, but one only existed for the last
            // stretch of the window and must not be marked down for it.
            const day = 24 * 3600 * 1000;
            const ago = (days: number) => toDayKey(Date.now() - days * day);
            await seedPartStudio(db);
            await seedAssembly(db);
            await db.insert(insertableStats).values([
                {
                    libraryId: TEST_LIBRARY_ID,
                    elementId,
                    insertCount: 10,
                    firstInsertedAt: Date.now() - 300 * day,
                    lastInsertedAt: Date.now()
                },
                {
                    libraryId: TEST_LIBRARY_ID,
                    elementId: TEST_ASSEMBLY_PATH.elementId,
                    insertCount: 10,
                    firstInsertedAt: Date.now() - 30 * day,
                    lastInsertedAt: Date.now()
                }
            ]);
            await seedInserts(10, { day: ago(200) });
            await seedInserts(10, {
                day: ago(20),
                element: TEST_ASSEMBLY_PATH.elementId
            });

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body[0].elementId).toBe(TEST_ASSEMBLY_PATH.elementId);
        });

        it("plots recent inserts per day, oldest first", async () => {
            await seedPartStudio(db);
            await seedInserts(2);

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body[0].recent).toHaveLength(SPARKLINE_DAYS);
            expect(body[0].recent.at(-1)).toBe(2);
            expect(body[0].recent.slice(0, -1)).toEqual(
                Array.from({ length: SPARKLINE_DAYS - 1 }, () => 0)
            );
        });

        it("keeps the sparkline at 30 days whatever the range", async () => {
            // It is a shape, not a window: two years of points in a sparkline
            // is a smear.
            await seedPartStudio(db);
            await seedInserts(2);

            const res = await anonymousGet(
                partsUrl("?from=2026-08-01&to=2026-08-07")
            );
            const body: PartUsageOut[] = await res.json();

            expect(body[0].recent).toHaveLength(SPARKLINE_DAYS);
        });

        it("gives a never-used part a flat sparkline", async () => {
            await seedPartStudio(db);

            const res = await anonymousGet(partsUrl());
            const body: PartUsageOut[] = await res.json();

            expect(body[0].recent).toEqual(
                Array.from({ length: SPARKLINE_DAYS }, () => 0)
            );
        });
    });

    describe("favorite totals", () => {
        it("counts favorites as standing state, not over the range", async () => {
            await seedTestData(db);
            // Deliberately outside any range the dashboard can select.
            await seedMetric("2020-01-01", 1);

            const res = await anonymousGet(
                "/api/analytics/overview?from=2026-01-01&to=2026-01-02"
            );
            const body: AnalyticsOverviewOut = await res.json();

            // seedTestData favorites the part studio and the assembly.
            expect(body.totals.favorites).toBe(2);
        });

        it("scopes the count to one library", async () => {
            await seedTestData(db);

            const res = await anonymousGet(
                `/api/analytics/summary/library/${LibraryId.MKCAD}`
            );
            const body: LibrarySummary = await res.json();

            expect(body.totals.favorites).toBe(0);
        });
    });

    describe("GET /analytics/unused-options/library/:libraryId", () => {
        const ENUM_PARAMETER: ConfigurationParameter = {
            type: ParameterType.ENUM,
            id: "stages",
            name: "Stages",
            isCosmetic: false,
            default: "one",
            options: [
                { id: "one", name: "1 Stage" },
                { id: "two", name: "2 Stage" },
                { id: "three", name: "3 Stage" }
            ],
            optionConditions: []
        };

        async function seedEnumPart() {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedConfiguration(db);
            await db
                .update(configurations)
                .set({ parameters: [ENUM_PARAMETER] });
        }

        it("surfaces an option nobody has ever picked", async () => {
            await seedEnumPart();
            await seedInserts(4, { configuration: { stages: "two" } });

            const res = await anonymousGet(
                `/api/analytics/unused-options/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            const body: UnusedOptionOut[] = await res.json();

            expect(body.map((row) => row.value)).toEqual(["one", "three"]);
            expect(body[0]).toMatchObject({
                partName: "Test PARTSTUDIO",
                parameterName: "Stages",
                count: 0,
                parameterTotal: 4
            });
        });

        it("flags a default that nobody picks", async () => {
            await seedEnumPart();
            await seedInserts(3, { configuration: { stages: "two" } });

            const res = await anonymousGet(
                `/api/analytics/unused-options/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            const body: UnusedOptionOut[] = await res.json();

            const defaults = body.filter((row) => row.isDefault);
            expect(defaults).toHaveLength(1);
            expect(defaults[0].value).toBe("one");
        });

        it("leaves out an option used more than the threshold", async () => {
            await seedEnumPart();
            await seedInserts(6, { configuration: { stages: "one" } });

            const res = await anonymousGet(
                `/api/analytics/unused-options/library/${TEST_LIBRARY_ID}?threshold=5&${ALL_TIME}`
            );
            const body: UnusedOptionOut[] = await res.json();

            expect(body.map((row) => row.value)).toEqual(["two", "three"]);
        });

        it("ignores a parameter with no declared options", async () => {
            // A boolean or quantity has no option list, so "never used" is not
            // a question that can be asked of it.
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedConfiguration(db);

            const res = await anonymousGet(
                `/api/analytics/unused-options/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            expect(await res.json()).toEqual([]);
        });
    });

    describe("GET /analytics/unused/library/:libraryId", () => {
        it("includes never-inserted parts and honors the threshold", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const never = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            const neverBody: PartUsageOut[] = await never.json();
            expect(neverBody).toHaveLength(1);
            expect(neverBody[0].insertCount).toBe(0);

            await seedInserts(4);

            const under = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=5&${ALL_TIME}`
            );
            expect(await under.json<PartUsageOut[]>()).toHaveLength(1);

            const over = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=3&${ALL_TIME}`
            );
            expect(await over.json<PartUsageOut[]>()).toHaveLength(0);
        });

        it("reads a part nobody has used lately as low usage", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedInserts(20, { day: "2026-03-01" });

            const stale = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0&from=2026-04-01&to=2026-04-30`
            );
            expect(await stale.json<PartUsageOut[]>()).toHaveLength(1);

            const lifetime = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            expect(await lifetime.json<PartUsageOut[]>()).toHaveLength(0);
        });

        it("ignores hidden parts", async () => {
            await seedPartStudio(db);

            const res = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0&${ALL_TIME}`
            );
            expect(await res.json<PartUsageOut[]>()).toHaveLength(0);
        });
    });

    describe("GET /analytics/health/library/:libraryId", () => {
        it("counts an issue against the item that carries it", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({
                isVisible: true,
                buildIssues: [{ type: BuildIssueType.THUMBNAIL_FAILED }]
            });

            const res = await anonymousGet(
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`
            );
            const body: LibraryHealthCounts = await res.json();

            expect(body).toMatchObject({
                groupCount: 1,
                insertableCount: 1,
                errorCount: 1,
                healthyItems: 1
            });
        });

        it("merges configuration issues into the insertable", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedConfiguration(db);
            await db.update(configurations).set({
                buildIssues: [
                    { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }
                ]
            });

            const res = await anonymousGet(
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`
            );
            const body: LibraryHealthCounts = await res.json();

            expect(body.warningCount).toBe(1);
        });

        it("returns a clean report for a library with no issues", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const res = await anonymousGet(
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`
            );
            const body: LibraryHealthCounts = await res.json();

            expect(body.errorCount).toBe(0);
            expect(body.warningCount).toBe(0);
            expect(body.healthyItems).toBe(2);
        });
    });

    describe("GET /analytics/insertable/...", () => {
        it("reports usage, unique users and the configuration breakdown", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            await seedInserts(2, { configuration: { boolean: "false" } });
            await seedInserts(1, {
                userId: "user-b",
                configuration: { boolean: "false" }
            });

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}?${ALL_TIME}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body).toMatchObject({
                name: "Test PARTSTUDIO",
                insertCount: 3,
                uniqueUsers: 2
            });

            const parameter = body.parameters[0];
            expect(parameter.parameterId).toBe("boolean");
            expect(parameter.defaultValue).toBe("true");
        });

        it("returns empty counts for a part with no history", async () => {
            await seedPartStudio(db);

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}?${ALL_TIME}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body.insertCount).toBe(0);
            expect(body.parameters).toEqual([]);
        });

        it("counts only the uses the window covers", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            await seedInserts(2, {
                day: "2026-03-01",
                configuration: { boolean: "false" }
            });

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}?from=2026-04-01&to=2026-04-30`
            );
            const body: InsertableReportOut = await res.json();

            expect(body.insertCount).toBe(0);
            // The parameter is still listed; nothing was recorded against it.
            expect(body.parameters[0].total).toBe(0);
        });

        it("counts how many users have the part favorited", async () => {
            await seedPartStudio(db);
            await seedFavorite(db, TEST_PART_STUDIO_ID, "user-a");
            await seedFavorite(db, TEST_PART_STUDIO_ID, "user-b");

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body.favorites).toBe(2);
        });

        it("splits inserts by the tab they landed in", async () => {
            await seedPartStudio(db);
            await seedInserts(3, { target: ElementType.PART_STUDIO });
            await seedInserts(1, { target: ElementType.ASSEMBLY });

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}?${ALL_TIME}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body.targets).toEqual({ partStudio: 3, assembly: 1 });
        });

        it("rates uses over the span the part has been in use", async () => {
            await seedPartStudio(db);
            await seedInsertableStats(0, Date.now() - 90 * 24 * 3600 * 1000);
            await seedInserts(12);

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}?${ALL_TIME}`
            );
            const body: InsertableReportOut = await res.json();

            // Twelve uses over the 90 days since its first, not over a month.
            expect(body.insertCount).toBe(12);
            expect(body.usesPerMonth).toBe(4);
        });
    });
});

describe("buildParameterUsage", () => {
    const enumParameter: ConfigurationParameter = {
        type: ParameterType.ENUM,
        id: "size",
        name: "Size",
        default: "medium",
        isCosmetic: false,
        options: [
            { id: "small", name: "Small" },
            { id: "medium", name: "Medium" },
            { id: "large", name: "Large" }
        ],
        optionConditions: []
    };

    it("surfaces declared options that were never picked", () => {
        const [usage] = buildParameterUsage(
            [enumParameter],
            [
                { parameterId: "size", value: "large", count: 7 },
                { parameterId: "size", value: "medium", count: 2 }
            ]
        );

        expect(usage.total).toBe(9);
        const small = usage.values.find((value) => value.value === "small");
        expect(small).toMatchObject({ count: 0, label: "Small" });

        // The default is flagged even though it isn't the popular choice —
        // which is the whole point of the report.
        const medium = usage.values.find((value) => value.value === "medium");
        expect(medium?.isDefault).toBe(true);
        expect(usage.values[0].value).toBe("large");
    });

    it("drops values recorded against a parameter the part no longer has", () => {
        const usage = buildParameterUsage(
            [enumParameter],
            [{ parameterId: "removed", value: "1", count: 4 }]
        );

        expect(usage.map((entry) => entry.parameterId)).toEqual(["size"]);
    });

    it("labels a quantity in its own unit, not the one it is keyed in", () => {
        const [usage] = buildParameterUsage(
            [quantityParam("length")],
            [
                { parameterId: "length", value: "0.0254 m", count: 5 },
                { parameterId: "length", value: "0.0508 m", count: 2 }
            ]
        );

        expect(usage.values).toEqual([
            { value: "0.0254 m", label: "1 in", count: 5, isDefault: true },
            { value: "0.0508 m", label: "2 in", count: 2, isDefault: false }
        ]);
    });

    it("always shows a free-form parameter's default, even unused", () => {
        const [usage] = buildParameterUsage(
            [
                {
                    type: ParameterType.STRING,
                    id: "label",
                    name: "Label",
                    default: "none",
                    isCosmetic: false
                }
            ],
            [{ parameterId: "label", value: "custom", count: 2 }]
        );

        const defaultValue = usage.values.find((value) => value.isDefault);
        expect(defaultValue).toMatchObject({ value: "none", count: 0 });
    });
});

describe("summarizeHealth", () => {
    const cleanGroup = {
        id: "g1",
        buildIssues: [],
        lastLoadedAt: 1
    };
    const insertable = {
        id: "i1",
        groupId: "g1",
        buildIssues: [],
        lastLoadedAt: 1
    };

    it("counts every issue, including a lesser one on the same item", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [
                insertable,
                {
                    ...insertable,
                    id: "i2",
                    buildIssues: [
                        { type: BuildIssueType.LOAD_FAILED },
                        { type: BuildIssueType.NO_VENDORS }
                    ]
                },
                {
                    ...insertable,
                    id: "i3",
                    // Info-only, so it leaves the item unhealthy without
                    // landing on either tile.
                    buildIssues: [{ type: BuildIssueType.NO_THUMBNAIL_TAB }]
                }
            ],
            new Map()
        );

        expect(counts).toEqual({
            groupCount: 1,
            insertableCount: 3,
            errorCount: 1,
            warningCount: 1,
            healthyItems: 2
        });
    });

    it("counts an insertable's configuration issues as its own", () => {
        // The panel merges these, so the dashboard must not disagree.
        const counts = summarizeHealth(
            [cleanGroup],
            [insertable],
            new Map([
                ["i1", [{ type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }]]
            ])
        );

        expect(counts.warningCount).toBe(1);
        expect(counts.healthyItems).toBe(1); // the group
    });

    it("counts issues, not items, so two on one part read as two", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [insertable],
            new Map([
                [
                    "i1",
                    [
                        { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED },
                        { type: BuildIssueType.MANUAL_INDEXING_REQUIRED }
                    ]
                ]
            ])
        );

        expect(counts.warningCount).toBe(2);
        expect(counts.healthyItems).toBe(1);
    });

    it("reports a group's stored issues without recomputing any", () => {
        // Visibility checks now run in the workflow and on the visibility
        // toggle, so this only reads what they wrote.
        const counts = summarizeHealth(
            [
                {
                    ...cleanGroup,
                    buildIssues: [
                        { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES }
                    ]
                }
            ],
            [],
            new Map()
        );

        expect(counts.errorCount).toBe(1);
        expect(counts.healthyItems).toBe(0);
    });
});
