import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { dailyMetrics, dailyUserActivity } from "../../db/schema";
import { EventType } from "./events";
import { LibraryId } from "../library/library-id";
import { resetDb, seedLibrary, TEST_LIBRARY_ID } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { getGrowth, recentWindows, RECENT_DAYS, toComparison } from "./growth";

const db = getDb(env.DB);

/** Late August: outside both seasons, so season comparisons use whole ones. */
const TODAY = "2026-08-27";

async function seedInserts(
    day: string,
    count: number,
    libraryId = TEST_LIBRARY_ID
) {
    await seedLibrary(db, libraryId);
    await db
        .insert(dailyMetrics)
        .values({ day, libraryId, type: EventType.INSERT, count })
        .onConflictDoNothing();
}

async function seedActive(day: string, userId: string) {
    await seedLibrary(db);
    await db
        .insert(dailyUserActivity)
        .values({ day, libraryId: TEST_LIBRARY_ID, userId })
        .onConflictDoNothing();
}

const WINDOWS = recentWindows(TODAY);
const LABELS = { label: "current", baselineLabel: "before" };

describe("recentWindows", () => {
    it("ends yesterday, so a part-finished today cannot drag it down", () => {
        expect(WINDOWS.current.to).toBe("2026-08-26");
    });

    it("puts two equal, adjacent windows back to back", () => {
        expect(WINDOWS.current.from).toBe("2026-07-30");
        expect(WINDOWS.previous.to).toBe("2026-07-29");
        expect(WINDOWS.previous.from).toBe("2026-07-02");
    });
});

describe("toComparison", () => {
    it("states a change when both windows are covered by tracking", () => {
        const out = toComparison(120, 100, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeCloseTo(0.2);
        expect(out.unavailable).toBeUndefined();
    });

    it("withholds a change when the baseline predates tracking", () => {
        // The whole prior window is before anything was recorded, so its zero
        // means "not measured", not "nothing happened".
        const out = toComparison(120, 0, WINDOWS, LABELS, "2026-08-01");
        expect(out.changeRatio).toBeNull();
        expect(out.unavailable).toBe("no-prior-data");
    });

    it("flags a baseline that tracking only partly covers", () => {
        const out = toComparison(120, 40, WINDOWS, LABELS, "2026-07-10");
        expect(out.changeRatio).toBeNull();
        expect(out.unavailable).toBe("partial-prior-data");
    });

    it("reads a genuinely empty baseline as new, not as an infinite rise", () => {
        const out = toComparison(9, 0, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeNull();
        expect(out.unavailable).toBe("zero-baseline");
    });

    it("blames the quiet period, not tracking, when both are empty", () => {
        const out = toComparison(0, 0, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeNull();
        expect(out.unavailable).toBe("no-activity");
    });

    it("states a decline as readily as a rise", () => {
        const out = toComparison(50, 100, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeCloseTo(-0.5);
    });
});

describe("getGrowth", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("compares the trailing window against the one before it", async () => {
        await seedInserts("2026-08-10", 30); // current
        await seedInserts("2026-07-10", 20); // previous

        const growth = await getGrowth(db, TODAY, "2026-01-01");

        expect(growth.recent.inserts.current).toBe(30);
        expect(growth.recent.inserts.previous).toBe(20);
        expect(growth.recent.inserts.changeRatio).toBeCloseTo(0.5);
    });

    it("counts a person once per window, not once overall", async () => {
        await seedActive("2026-08-10", "user-a");
        await seedActive("2026-08-11", "user-a");
        await seedActive("2026-07-10", "user-a");

        const growth = await getGrowth(db, TODAY, "2026-01-01");

        expect(growth.recent.activeUsers.current).toBe(1);
        expect(growth.recent.activeUsers.previous).toBe(1);
    });

    it("compares whole seasons when today is between them", async () => {
        // August is off-season, so FRC 2026 is compared with FRC 2025.
        await seedInserts("2026-03-01", 100);
        await seedInserts("2025-03-01", 50);

        const growth = await getGrowth(db, TODAY, "2025-01-01");

        expect(growth.season.label).toBe("FRC 2026");
        expect(growth.season.baselineLabel).toBe("FRC 2025");
        expect(growth.season.current).toBe(100);
        expect(growth.season.previous).toBe(50);
        expect(growth.season.changeRatio).toBeCloseTo(1);
    });

    it("clips an in-season baseline to the same elapsed stretch", async () => {
        // 1 Feb is 32 days in. Last season's whole run was 60, but only the
        // 40 inside its first 32 days may be compared against.
        await seedInserts("2027-01-15", 25);
        await seedInserts("2026-01-15", 40);
        await seedInserts("2026-03-15", 20);

        const growth = await getGrowth(db, "2027-02-01", "2025-01-01");

        expect(growth.season.label).toBe("FRC 2027 so far");
        expect(growth.season.baselineLabel).toBe("FRC 2026 at the same point");
        expect(growth.season.current).toBe(25);
        expect(growth.season.previous).toBe(40);
    });

    it("withholds the season change before a second season exists", async () => {
        await seedInserts("2026-03-01", 100);

        const growth = await getGrowth(db, TODAY, "2026-01-01");

        expect(growth.season.current).toBe(100);
        expect(growth.season.changeRatio).toBeNull();
        expect(growth.season.unavailable).toBe("no-prior-data");
    });

    it("reports nothing rather than failing with no data at all", async () => {
        const growth = await getGrowth(db, TODAY, null);

        expect(growth.recent.inserts.current).toBe(0);
        expect(growth.recent.inserts.changeRatio).toBeNull();
        expect(growth.recent.inserts.unavailable).toBe("no-prior-data");
        expect(growth.season.changeRatio).toBeNull();
        expect(growth.trackingSince).toBeNull();
    });

    it("scopes to one library and uses that library's own season", async () => {
        await seedInserts("2026-08-10", 30, TEST_LIBRARY_ID);
        await seedInserts("2026-08-10", 99, LibraryId.MKCAD);

        const growth = await getGrowth(
            db,
            TODAY,
            "2026-01-01",
            TEST_LIBRARY_ID
        );
        expect(growth.recent.inserts.current).toBe(30);

        // FTCDesignLib runs Sept–Apr, so its off-season season differs.
        const ftc = await getGrowth(
            db,
            TODAY,
            "2026-01-01",
            LibraryId.FTC_DESIGN_LIB
        );
        expect(ftc.season.label).toBe("FTC 2025–26");
    });

    describe("seasonCurve", () => {
        it("lays last season out in full beside this one so far", async () => {
            // Week 2 of FRC 2027 against a 2026 season that ran to April.
            await seedInserts("2027-01-16", 10);
            await seedInserts("2026-01-16", 4);
            await seedInserts("2026-04-01", 6);

            const { seasonCurve } = await getGrowth(
                db,
                "2027-01-25",
                "2025-01-01"
            );

            expect(seasonCurve.label).toBe("FRC 2027");
            expect(seasonCurve.baselineLabel).toBe("FRC 2026");
            // Cumulative, so last season's line keeps climbing to its total.
            const previous = seasonCurve.points.map((p) => p.previous);
            expect(previous[2]).toBe(4);
            expect(previous[previous.length - 1]).toBe(10);
        });

        it("stops this season's line at the last whole week", async () => {
            // 25 Jan is 24 days in: three whole weeks, and a fourth running.
            const { seasonCurve } = await getGrowth(
                db,
                "2027-01-25",
                "2025-01-01"
            );

            const drawn = seasonCurve.points.filter((p) => p.current !== null);
            expect(drawn).toHaveLength(3);
            expect(seasonCurve.points[3].current).toBeNull();
        });

        it("draws a finished season end to end", async () => {
            const { seasonCurve } = await getGrowth(db, TODAY, "2025-01-01");

            expect(seasonCurve.points.every((p) => p.current !== null)).toBe(
                true
            );
        });

        it("counts only the selected library", async () => {
            await seedInserts("2027-01-08", 5, TEST_LIBRARY_ID);
            await seedInserts("2027-01-08", 50, LibraryId.MKCAD);

            const { seasonCurve } = await getGrowth(
                db,
                "2027-02-01",
                "2025-01-01",
                TEST_LIBRARY_ID
            );

            expect(seasonCurve.points[1].current).toBe(5);
        });
    });

    it("uses a window of whole weeks", () => {
        expect(RECENT_DAYS % 7).toBe(0);
    });
});
