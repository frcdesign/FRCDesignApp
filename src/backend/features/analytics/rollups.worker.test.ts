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
import { AppFeature, UseSource } from "./usage";
import { SIGNED_OUT_USER_ID } from "./logged-event";
import {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";
import { rollupWrites } from "./rollups";
import {
    dailyAppOpens,
    dailyConfigurationMetrics,
    dailyFeatureUsers,
    userFirstSeen,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    dailyVersionMetrics,
    events,
    insertableStats,
    userStats
} from "./schema";
import {
    trackAppOpen,
    trackDefaultSelection,
    trackDownload,
    trackFeatureAdd,
    trackInsert,
    trackReport,
    trackVersionRun,
    type InsertEvent
} from "./tracking";
import {
    PushScopeKind,
    VersionJobKind,
    VersionJobState
} from "../version-manager/contract";

const db = getDb(env.DB);
const SIZE_PARAMETERS = [enumParam("size", ["small", "large"])];

/** Every table the rollups write, read whole so a replay can be compared. */
const ROLLUPS = [
    dailyAppOpens,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyConfigurationMetrics,
    dailyVersionMetrics,
    dailyFeatureUsers,
    userFirstSeen,
    insertableStats,
    userStats
];

function fakeContext(userId = TEST_USER_ID): AppContext {
    return {
        env,
        var: { getUserId: () => Promise.resolve(userId) }
    } as unknown as AppContext;
}

function insertEvent(overrides: Partial<InsertEvent> = {}): InsertEvent {
    return {
        libraryId: TEST_LIBRARY_ID,
        path: TEST_PART_STUDIO_PATH,
        insertableId: TEST_PART_STUDIO_ID,
        targetElementType: ElementType.PART_STUDIO,
        selection: undefined,
        parameters: [],
        isFavorite: false,
        isQuickInsert: false,
        source: UseSource.BROWSE,
        fasten: false,
        fastenable: false,
        preselected: false,
        atInsertLocation: false,
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
        const day = 24 * 3600 * 1000;
        const start = Date.parse("2026-03-01T09:00:00Z");
        const clock = vi.spyOn(Date, "now");

        clock.mockReturnValue(start);
        await trackAppOpen(fakeContext());
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
                source: UseSource.FAVORITES,
                fasten: true
            })
        );
        await trackInsert(fakeContext("someone-2"), insertEvent());
        await trackVersionRun(env, {
            userId: TEST_USER_ID,
            kind: VersionJobKind.PUSH,
            scope: PushScopeKind.CHILDREN,
            status: {
                state: VersionJobState.COMPLETE,
                result: { createdVersions: 1, updatedElements: 5 }
            }
        });
        clock.mockRestore();

        const live = await readRollups();
        expect(live.every((rows) => rows.length > 0)).toBe(true);

        // Newest first, since a job needn't read rows in order.
        for (const table of ROLLUPS) {
            await db.delete(table);
        }
        const log = await db.select().from(events).all();
        const writes = log
            .reverse()
            .flatMap((row) => rollupWrites(db, row, SIZE_PARAMETERS));
        await db.batch([writes[0], ...writes.slice(1)]);

        expect(await readRollups()).toEqual(live);
    });
    describe("feature users", () => {
        const pushed = {
            state: VersionJobState.COMPLETE,
            result: { createdVersions: 0, updatedElements: 0 }
        };

        /** One of every event that is a use of some feature, by its own user. */
        async function trackEveryFeature(): Promise<void> {
            await trackInsert(
                fakeContext("searcher"),
                insertEvent({ source: UseSource.GROUP_SEARCH })
            );
            await trackInsert(
                fakeContext("fan"),
                insertEvent({ source: UseSource.FAVORITES })
            );
            await trackInsert(
                fakeContext("regular"),
                insertEvent({ source: UseSource.RECENTS, isQuickInsert: true })
            );
            await trackInsert(
                fakeContext("assembler"),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY,
                    fasten: true
                })
            );
            await trackInsert(
                fakeContext("picker"),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY,
                    fasten: true,
                    fastenable: true,
                    preselected: true
                })
            );
            // Fastened by the run's planner, not by a choice to fasten.
            await trackInsert(
                fakeContext("planner"),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY,
                    source: UseSource.AUTO_ASSEMBLY,
                    fasten: true,
                    fastenable: true
                })
            );
            await trackDownload(fakeContext("downloader"), insertEvent());
            await trackVersionRun(env, {
                userId: "pusher",
                kind: VersionJobKind.PUSH,
                scope: PushScopeKind.CHILDREN,
                status: pushed
            });
            await trackFeatureAdd(fakeContext("scripter"), {
                featureType: "robotFrame",
                path: TEST_PART_STUDIO_PATH
            });
            for (const userId of ["reporter", undefined]) {
                await trackReport(fakeContext(), {
                    id: crypto.randomUUID(),
                    userId,
                    libraryId: undefined,
                    topic: FeedbackTopic.APP,
                    category: FeedbackCategory.BUG,
                    source: FeedbackSource.GENERAL
                });
            }
            await trackInsert(fakeContext("browser"), insertEvent());
        }

        async function readFeatureUsers() {
            const rows = await db.select().from(dailyFeatureUsers).all();
            return rows
                .map(({ feature, userId }) => `${feature} ${userId}`)
                .sort();
        }

        it("records who used each feature, and nobody for a plain insert", async () => {
            await trackEveryFeature();
            await trackInsert(
                fakeContext("placer"),
                insertEvent({
                    targetElementType: ElementType.ASSEMBLY,
                    atInsertLocation: true
                })
            );
            await trackDefaultSelection(fakeContext("configurer"), {
                libraryId: TEST_LIBRARY_ID,
                path: TEST_PART_STUDIO_PATH,
                insertableId: TEST_PART_STUDIO_ID
            });

            expect(await readFeatureUsers()).toEqual(
                [
                    `${AppFeature.SEARCH} searcher`,
                    `${AppFeature.FAVORITES} fan`,
                    `${AppFeature.RECENTS} regular`,
                    `${AppFeature.QUICK_INSERT} regular`,
                    `${AppFeature.FASTEN} assembler`,
                    `${AppFeature.FASTEN} picker`,
                    `${AppFeature.PRESELECTION} picker`,
                    `${AppFeature.AUTO_ASSEMBLY} planner`,
                    `${AppFeature.INSERT_LOCATION} placer`,
                    `${AppFeature.DOWNLOAD} downloader`,
                    `${AppFeature.DEFAULT_CONFIGURATION} configurer`,
                    `${AppFeature.VERSION_MANAGER} pusher`,
                    `${AppFeature.FEATURESCRIPTS} scripter`,
                    `${AppFeature.REPORT} reporter`
                ].sort()
            );
            expect(await readFeatureUsers()).not.toContainEqual(
                expect.stringContaining(SIGNED_OUT_USER_ID)
            );
        });

        it("doesn't count a default configuration as activity", async () => {
            await trackDefaultSelection(fakeContext(), {
                libraryId: TEST_LIBRARY_ID,
                path: TEST_PART_STUDIO_PATH,
                insertableId: TEST_PART_STUDIO_ID
            });

            expect(await db.select().from(dailyUserActivity).all()).toEqual([]);
            expect(await db.select().from(userStats).all()).toEqual([]);
        });

        it("keeps each person's first day, whatever order the log replays in", async () => {
            const day = 24 * 3600 * 1000;
            const clock = vi.spyOn(Date, "now");
            clock.mockReturnValue(Date.parse("2026-03-02T15:00:00Z"));
            await trackInsert(fakeContext("regular"), insertEvent());
            clock.mockReturnValue(Date.parse("2026-03-02T15:00:00Z") - day);
            await trackAppOpen(fakeContext("regular"));
            clock.mockRestore();
            await trackReport(fakeContext(), {
                id: crypto.randomUUID(),
                userId: undefined,
                libraryId: undefined,
                topic: FeedbackTopic.APP,
                category: FeedbackCategory.BUG,
                source: FeedbackSource.GENERAL
            });

            expect(await db.select().from(userFirstSeen).all()).toEqual([
                { userId: "regular", firstDay: "2026-03-01" }
            ]);
        });

        it("is filled from the rollups by the migration that added it", async () => {
            await trackAppOpen(fakeContext("opener"));
            await trackEveryFeature();
            const live = await db.select().from(userFirstSeen).all();
            expect(live.length).toBeGreaterThan(5);

            const migration = env.TEST_MIGRATIONS.find((m) =>
                m.name.includes("feature_reach")
            );
            const backfill = (migration?.queries ?? []).filter((query) =>
                query.includes("INSERT INTO `user_first_seen`")
            );
            expect(backfill).toHaveLength(1);
            await db.delete(userFirstSeen);
            await env.DB.batch(backfill.map((query) => env.DB.prepare(query)));

            const byUser = (a: { userId: string }, b: { userId: string }) =>
                a.userId.localeCompare(b.userId);
            expect(
                (await db.select().from(userFirstSeen).all()).sort(byUser)
            ).toEqual(live.sort(byUser));
        });
    });
});
