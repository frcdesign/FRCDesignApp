import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
    configurations,
    configurationValueStats,
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    events,
    insertables,
    insertableStats,
    userStats
} from "../../db/schema";
import {
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_PATH,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedPartStudio,
    seedTestData
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { createApp } from "../../app";
import { EventType, InsertSource } from "./events";
import { LibraryId } from "../library/library-id";
import { ParameterType } from "../configurations/models";
import type {
    AnalyticsOverviewOut,
    InsertableReportOut,
    LibraryHealthOut,
    PartUsageOut
} from "./contract";
import { buildParameterUsage, summarizeHealth } from "./routes";
import { BuildIssueSeverity, BuildIssueType } from "../build-checker/issues";
import type { ConfigurationParameter } from "../configurations/models";

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
            expect(body.metricSeries).toEqual([
                {
                    day: "2026-03-01",
                    inserts: 10,
                    appOpens: 0,
                    activeUsers: 0,
                    favoriteInserts: 4,
                    fastenInserts: 3,
                    quickInserts: 6,
                    assemblyInserts: 5
                }
            ]);
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
            expect(body.rangeTotals.inserts).toBe(3);
            expect(body.rangeTotals.uniqueUsers).toBe(1);
            // The daily trend counts each day's actives separately.
            expect(
                body.metricSeries.map((point) => [point.day, point.activeUsers])
            ).toEqual([
                ["2026-06-15", 1],
                ["2026-06-16", 1]
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

            expect(body.series).toHaveLength(1);
            expect(body.series[0].day).toBe("2026-06-01");
            // Totals stay lifetime, independent of the range.
            expect(body.totals.inserts).toBe(7);
        });
    });

    describe("GET /analytics/parts/library/:libraryId", () => {
        it("lists a visible part that has never been inserted", async () => {
            // The picker needs every part, not only the ones with history.
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const res = await anonymousGet(
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`
            );
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({
                elementId,
                name: "Test PARTSTUDIO",
                insertCount: 0,
                lastInsertedAt: null
            });
            // Enough to build both links the picker offers.
            expect(body[0].documentId).toBeTruthy();
            expect(body[0].versionId).toBeTruthy();
        });

        it("sorts used parts above unused ones", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            await db.update(insertables).set({ isVisible: true });
            await seedInsertableStats(4);

            const res = await anonymousGet(
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`
            );
            const body: PartUsageOut[] = await res.json();

            expect(body.map((row) => row.insertCount)).toEqual([4, 0]);
            expect(body[0].elementId).toBe(elementId);
        });

        it("keeps history for a part that is no longer visible", async () => {
            // Hidden parts drop out of the library half, so without the second
            // half their usage would vanish from the report entirely.
            await seedPartStudio(db);
            await seedInsertableStats(9);

            const res = await anonymousGet(
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`
            );
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0]).toMatchObject({ elementId, insertCount: 9 });
        });

        it("does not list a part twice", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });
            await seedInsertableStats(3);

            const res = await anonymousGet(
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`
            );
            const body: PartUsageOut[] = await res.json();

            expect(body).toHaveLength(1);
            expect(body[0].insertCount).toBe(3);
        });

        it("joins live insertables and orders by insert count", async () => {
            await seedPartStudio(db);
            await seedInsertableStats(9);
            await db.insert(insertableStats).values({
                libraryId: TEST_LIBRARY_ID,
                elementId: "e-gone",
                insertCount: 30,
                firstInsertedAt: 1,
                lastInsertedAt: 2
            });

            const res = await anonymousGet(
                `/api/analytics/parts/library/${TEST_LIBRARY_ID}`
            );
            const body: PartUsageOut[] = await res.json();

            expect(body.map((row) => row.elementId)).toEqual([
                "e-gone",
                elementId
            ]);
            // History outlives the insertable row it came from.
            expect(body[0].name).toBeNull();
            expect(body[1]).toMatchObject({
                name: "Test PARTSTUDIO",
                groupName: "Test Group",
                insertCount: 9
            });
        });
    });

    describe("GET /analytics/unused/library/:libraryId", () => {
        it("includes never-inserted parts and honors the threshold", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const never = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0`
            );
            const neverBody: PartUsageOut[] = await never.json();
            expect(neverBody).toHaveLength(1);
            expect(neverBody[0].insertCount).toBe(0);

            await seedInsertableStats(4);

            const under = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=5`
            );
            expect(await under.json<PartUsageOut[]>()).toHaveLength(1);

            const over = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=3`
            );
            expect(await over.json<PartUsageOut[]>()).toHaveLength(0);
        });

        it("ignores hidden parts", async () => {
            await seedPartStudio(db);

            const res = await anonymousGet(
                `/api/analytics/unused/library/${TEST_LIBRARY_ID}?threshold=0`
            );
            expect(await res.json<PartUsageOut[]>()).toHaveLength(0);
        });
    });

    describe("GET /analytics/health/library/:libraryId", () => {
        it("reports stored issues with the item that carries them", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({
                isVisible: true,
                buildIssues: [{ type: BuildIssueType.THUMBNAIL_FAILED }]
            });

            const res = await anonymousGet(
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`
            );
            const body: LibraryHealthOut = await res.json();

            expect(body.counts).toMatchObject({
                groupCount: 1,
                insertableCount: 1,
                errorItems: 1,
                healthyItems: 1
            });
            expect(body.issues).toEqual([
                {
                    type: BuildIssueType.THUMBNAIL_FAILED,
                    description: "Thumbnail failed to generate",
                    severity: BuildIssueSeverity.ERROR,
                    count: 1
                }
            ]);

            const item = body.items[0];
            expect(item).toMatchObject({
                kind: "insertable",
                name: "Test PARTSTUDIO",
                groupName: "Test Group",
                severity: BuildIssueSeverity.ERROR
            });
            // Enough to build the Onshape deep link.
            expect(item.elementId).toBe(elementId);
            expect(item.documentId).toBeTruthy();
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
            const body: LibraryHealthOut = await res.json();

            expect(body.counts.warningItems).toBe(1);
            expect(body.items[0].issues).toEqual([
                BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED
            ]);
        });

        it("returns a clean report for a library with no issues", async () => {
            await seedPartStudio(db);
            await db.update(insertables).set({ isVisible: true });

            const res = await anonymousGet(
                `/api/analytics/health/library/${TEST_LIBRARY_ID}`
            );
            const body: LibraryHealthOut = await res.json();

            expect(body.items).toEqual([]);
            expect(body.issues).toEqual([]);
            expect(body.counts.healthyItems).toBe(2);
        });
    });

    describe("GET /analytics/insertable/...", () => {
        it("reports usage, unique users and the configuration breakdown", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            await seedInsertableStats(3);
            await db.insert(configurationValueStats).values({
                libraryId: TEST_LIBRARY_ID,
                elementId,
                parameterId: "boolean",
                value: "false",
                count: 3
            });
            await db.insert(events).values([
                {
                    type: EventType.INSERT,
                    createdAt: 1,
                    day: "2026-03-01",
                    libraryId: TEST_LIBRARY_ID,
                    userId: "user-a",
                    elementId
                },
                {
                    type: EventType.INSERT,
                    createdAt: 2,
                    day: "2026-03-01",
                    libraryId: TEST_LIBRARY_ID,
                    userId: "user-b",
                    elementId
                }
            ]);

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body).toMatchObject({
                name: "Test PARTSTUDIO",
                insertCount: 3,
                uniqueUsers: 2
            });
            expect(body.series).toEqual([{ day: "2026-03-01", count: 2 }]);

            const parameter = body.parameters[0];
            expect(parameter.parameterId).toBe("boolean");
            expect(parameter.isRetired).toBe(false);
            expect(parameter.defaultValue).toBe("true");
        });

        it("returns empty counts for a part with no history", async () => {
            await seedPartStudio(db);

            const res = await anonymousGet(
                `/api/analytics/insertable/library/${TEST_LIBRARY_ID}/element/${elementId}`
            );
            const body: InsertableReportOut = await res.json();

            expect(body.insertCount).toBe(0);
            expect(body.series).toEqual([]);
            expect(body.parameters).toEqual([]);
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

    it("keeps values recorded against parameters that no longer exist", () => {
        const usage = buildParameterUsage(
            [enumParameter],
            [{ parameterId: "removed", value: "1", count: 4 }]
        );

        const retired = usage.find((entry) => entry.parameterId === "removed");
        expect(retired).toMatchObject({ isRetired: true, total: 4 });
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

    it("counts each item by its worst severity", () => {
        const { counts } = summarizeHealth(
            [cleanGroup],
            [
                insertable,
                {
                    ...insertable,
                    id: "i2",
                    // An error and an info together count once, as an error.
                    buildIssues: [
                        { type: BuildIssueType.LOAD_FAILED },
                        { type: BuildIssueType.NO_VENDORS }
                    ]
                },
                {
                    ...insertable,
                    id: "i3",
                    buildIssues: [{ type: BuildIssueType.NO_THUMBNAIL_TAB }]
                }
            ],
            new Map()
        );

        expect(counts).toMatchObject({
            groupCount: 1,
            insertableCount: 3,
            errorItems: 1,
            warningItems: 1,
            infoItems: 0,
            healthyItems: 2
        });
    });

    it("counts an insertable's configuration issues as its own", () => {
        // The panel merges these, so the dashboard must not disagree.
        const { counts, items } = summarizeHealth(
            [cleanGroup],
            [insertable],
            new Map([
                ["i1", [{ type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }]]
            ])
        );

        expect(counts.warningItems).toBe(1);
        expect(counts.healthyItems).toBe(1); // the group
        expect(items[0].issues).toEqual([
            BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED
        ]);
    });

    it("reports a group's stored issues without recomputing any", () => {
        // Visibility checks now run in the workflow and on the visibility
        // toggle, so this only reads what they wrote.
        const { items } = summarizeHealth(
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

        const groupItem = items.find((item) => item.kind === "group");
        expect(groupItem?.issues).toEqual([
            BuildIssueType.NO_UNHIDDEN_INSERTABLES
        ]);
        expect(groupItem?.severity).toBe(BuildIssueSeverity.ERROR);
    });

    it("tallies issue kinds and sorts them worst first", () => {
        const { issues } = summarizeHealth(
            [cleanGroup],
            [
                {
                    ...insertable,
                    buildIssues: [{ type: BuildIssueType.NO_VENDORS }]
                },
                {
                    ...insertable,
                    id: "i2",
                    buildIssues: [{ type: BuildIssueType.NO_VENDORS }]
                },
                {
                    ...insertable,
                    id: "i3",
                    buildIssues: [{ type: BuildIssueType.THUMBNAIL_FAILED }]
                }
            ],
            new Map()
        );

        // The single error outranks the two infos.
        expect(issues[0]).toMatchObject({
            type: BuildIssueType.THUMBNAIL_FAILED,
            severity: BuildIssueSeverity.ERROR,
            count: 1
        });
        expect(issues[1]).toMatchObject({
            type: BuildIssueType.NO_VENDORS,
            count: 2
        });
    });

    it("counts items that have never loaded", () => {
        const { counts } = summarizeHealth(
            [cleanGroup],
            [{ ...insertable, lastLoadedAt: null }],
            new Map()
        );

        expect(counts.neverLoaded).toBe(1);
    });
});
