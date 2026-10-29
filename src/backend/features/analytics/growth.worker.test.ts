import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { dailyAppOpens, dailyMetrics, dailyUserActivity } from "./schema";
import { ChangeUnavailable } from "./contract";
import { EventType } from "./usage";
import { LibraryId } from "../library/library-id";
import { resetDb, seedLibrary, TEST_LIBRARY_ID } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { getGrowth, toComparison } from "./growth";

const db = getDb(env.DB);

/** Late August, outside both seasons. */
const THROUGH = "2026-08-26";

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

async function seedOpens(day: string, opens: number, userId = "user-a") {
    await db
        .insert(dailyAppOpens)
        .values({ day, userId, opens })
        .onConflictDoNothing();
}

async function seedActive(day: string, userId: string) {
    await seedLibrary(db);
    await db
        .insert(dailyUserActivity)
        .values({ day, libraryId: TEST_LIBRARY_ID, userId })
        .onConflictDoNothing();
}

/** Two adjacent months, for the comparison tests, which need no season. */
const WINDOWS = {
    current: { from: "2026-07-28", to: THROUGH },
    previous: { from: "2026-06-28", to: "2026-07-27" }
};
const LABELS = {
    label: "current",
    baselineLabel: "before",
    baselineShort: "before"
};

describe("toComparison", () => {
    it("states a change when both windows are covered by tracking", () => {
        const out = toComparison(120, 100, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeCloseTo(0.2);
        expect(out.unavailable).toBeUndefined();
    });

    it("withholds a change when the baseline predates tracking", () => {
        // The prior window predates tracking, so its zero means "not measured".
        const out = toComparison(120, 0, WINDOWS, LABELS, "2026-08-01");
        expect(out.changeRatio).toBeUndefined();
        expect(out.unavailable).toBe(ChangeUnavailable.NO_PRIOR_DATA);
    });

    it("flags a baseline that tracking only partly covers", () => {
        const out = toComparison(120, 40, WINDOWS, LABELS, "2026-07-10");
        expect(out.changeRatio).toBeUndefined();
        expect(out.unavailable).toBe(ChangeUnavailable.PARTIAL_PRIOR_DATA);
    });

    it("reads a genuinely empty baseline as new, not as an infinite rise", () => {
        const out = toComparison(9, 0, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeUndefined();
        expect(out.unavailable).toBe(ChangeUnavailable.ZERO_BASELINE);
    });

    it("blames the quiet period, not tracking, when both are empty", () => {
        const out = toComparison(0, 0, WINDOWS, LABELS, "2026-01-01");
        expect(out.changeRatio).toBeUndefined();
        expect(out.unavailable).toBe(ChangeUnavailable.NO_ACTIVITY);
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

    it("counts a person once per season, not once per active day", async () => {
        await seedActive("2026-03-01", "user-a");
        await seedActive("2026-03-02", "user-a");
        await seedActive("2025-03-01", "user-a");

        const growth = await getGrowth(db, THROUGH, "2024-09-01");

        expect(growth.activeUsers.current).toBe(1);
        expect(growth.activeUsers.previous).toBe(1);
    });

    it("counts somebody who only ever opened the app as a user", async () => {
        await seedOpens("2026-03-01", 3, "opener");

        const growth = await getGrowth(db, THROUGH, "2024-09-01");

        expect(growth.activeUsers.current).toBe(1);
        expect(growth.appOpens?.current).toBe(3);
    });

    it("gives a library no opens of its own", async () => {
        await seedOpens("2026-03-01", 3);

        const growth = await getGrowth(
            db,
            THROUGH,
            "2024-09-01",
            TEST_LIBRARY_ID
        );

        expect(growth.appOpens).toBeUndefined();
        expect(growth.activeUsers.current).toBe(0);
    });

    it("compares whole seasons when the window falls between them", async () => {
        await seedInserts("2026-03-01", 100);
        await seedInserts("2025-03-01", 50);

        const growth = await getGrowth(db, THROUGH, "2024-09-01");

        expect(growth.inserts.label).toBe("2025–26 season");
        expect(growth.inserts.baselineLabel).toBe("2024–25 season");
        // The chip is terse; the exact season stays in the tooltip above.
        expect(growth.inserts.baselineShort).toBe("last season");
        expect(growth.inserts.current).toBe(100);
        expect(growth.inserts.previous).toBe(50);
        expect(growth.inserts.changeRatio).toBeCloseTo(1);
    });

    it("counts an FTC-only autumn the app-wide season would miss on FRC", async () => {
        // October is outside FRC's Jan–Apr, so measuring on FRC's span would drop it.
        await seedInserts("2025-10-15", 40);

        const growth = await getGrowth(db, THROUGH, "2024-09-01");

        expect(growth.inserts.current).toBe(40);
    });

    it("reports each measure over the season, not just uses", async () => {
        await seedInserts("2026-03-01", 100);
        await seedOpens("2026-03-01", 12);
        await seedActive("2026-03-01", "user-a");
        await seedActive("2026-03-02", "user-b");

        const growth = await getGrowth(db, THROUGH, "2024-09-01");

        expect(growth.appOpens?.current).toBe(12);
        expect(growth.activeUsers.current).toBe(2);
    });

    it("clips an in-season baseline to the same elapsed stretch", async () => {
        // Only the part of last season up to the same point may be compared.
        await seedInserts("2027-01-15", 25);
        await seedInserts("2026-01-15", 40);
        await seedInserts("2026-03-15", 20);

        const growth = await getGrowth(db, "2027-02-01", "2024-09-01");

        expect(growth.inserts.label).toBe("2026–27 season so far");
        expect(growth.inserts.baselineLabel).toBe(
            "2025–26 season at the same point"
        );
        expect(growth.inserts.current).toBe(25);
        expect(growth.inserts.previous).toBe(40);
    });

    it("withholds the season change before a second season exists", async () => {
        await seedInserts("2026-03-01", 100);

        const growth = await getGrowth(db, THROUGH, "2025-09-01");

        expect(growth.inserts.current).toBe(100);
        expect(growth.inserts.changeRatio).toBeUndefined();
        expect(growth.inserts.unavailable).toBe(
            ChangeUnavailable.NO_PRIOR_DATA
        );
    });

    it("reports nothing rather than failing with no data at all", async () => {
        const growth = await getGrowth(db, THROUGH, undefined);

        expect(growth.inserts.current).toBe(0);
        expect(growth.inserts.changeRatio).toBeUndefined();
        expect(growth.inserts.unavailable).toBe(
            ChangeUnavailable.NO_PRIOR_DATA
        );
    });

    it("scopes to one library and uses that library's own season", async () => {
        await seedInserts("2026-03-01", 30, TEST_LIBRARY_ID);
        await seedInserts("2026-03-01", 99, LibraryId.MKCAD);

        const growth = await getGrowth(
            db,
            THROUGH,
            "2024-09-01",
            TEST_LIBRARY_ID
        );
        expect(growth.inserts.current).toBe(30);

        // ConfigLib runs Sept–Apr, so its off-season season differs.
        const ftc = await getGrowth(
            db,
            THROUGH,
            "2024-09-01",
            LibraryId.CONFIG_LIB
        );
        expect(ftc.inserts.label).toBe("FTC 2025–26");
    });
});
