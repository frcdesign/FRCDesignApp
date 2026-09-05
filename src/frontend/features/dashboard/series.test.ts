import { describe, expect, it } from "vitest";
import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { toChartData, toSparkSeries } from "./series";

const FRC = getLibraryName(LibraryId.FRC_DESIGN_LIB);
const MKCAD = getLibraryName(LibraryId.MKCAD);

/** Builds `count` consecutive days starting at 2026-01-01. */
function makeDays(count: number): DailyInsertPoint[] {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, 1 + index));
        return {
            day: date.toISOString().slice(0, 10),
            counts: { [LibraryId.FRC_DESIGN_LIB]: 1 }
        };
    });
}

/** One day of metrics, zeroed but for what a test is about. */
function day(index: number, values: Partial<DailyMetricPoint> = {}) {
    return {
        day: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
        inserts: 0,
        appOpens: 0,
        activeUsers: 0,
        favoriteInserts: 0,
        quickInserts: 0,
        fastenInserts: 0,
        assemblyInserts: 0,
        ...values
    };
}

describe("toChartData", () => {
    it("gives every series a value on every point", () => {
        const data = toChartData(
            [
                {
                    day: "2026-01-01",
                    counts: { [LibraryId.FRC_DESIGN_LIB]: 4 }
                },
                { day: "2026-01-02", counts: { [LibraryId.MKCAD]: 2 } }
            ],
            [LibraryId.FRC_DESIGN_LIB, LibraryId.MKCAD]
        );

        // A missing library must read 0, not undefined, or the line breaks up.
        expect(data[0][FRC]).toBe(4);
        expect(data[0][MKCAD]).toBe(0);
        expect(data[1][FRC]).toBe(0);
        expect(data[1][MKCAD]).toBe(2);
    });

    it("keeps short ranges at daily resolution", () => {
        const data = toChartData(makeDays(30), [LibraryId.FRC_DESIGN_LIB]);
        expect(data).toHaveLength(30);
    });

    it("buckets a long range by month", () => {
        // 365 daily points would be unreadable, so they collapse to months.
        const data = toChartData(makeDays(365), [LibraryId.FRC_DESIGN_LIB]);

        // 365 days from Jan 1 of a non-leap year is exactly 12 months.
        expect(data).toHaveLength(12);
        expect(data[0][FRC]).toBe(31); // all of January
        expect(data[0].bucket).toBe("2026-01");
        expect(data[0].label).toBe("Jan 2026");
    });

    it("returns nothing for an empty series", () => {
        expect(toChartData([], [LibraryId.FRC_DESIGN_LIB])).toEqual([]);
    });

    it("takes a granularity over the one the span implies", () => {
        // 2026-01-01 is a Thursday, so the first week is a stub of 4 days.
        const data = toChartData(
            makeDays(30),
            [LibraryId.FRC_DESIGN_LIB],
            "week"
        );

        expect(data[0].bucket).toBe("2025-12-29");
        expect(data[0][FRC]).toBe(4);
        expect(data[1][FRC]).toBe(7);
    });
});

describe("toSparkSeries", () => {
    it("keeps a short range at one point per day", () => {
        const points = Array.from({ length: 30 }, (_, i) =>
            day(i, { inserts: 1 })
        );
        expect(toSparkSeries(points).inserts).toHaveLength(30);
    });

    it("folds a long range down, so a year is not a smear", () => {
        const points = Array.from({ length: 365 }, (_, i) =>
            day(i, { inserts: 2 })
        );
        const { inserts } = toSparkSeries(points);

        expect(inserts).toHaveLength(12);
        expect(inserts[0]).toBe(62); // all of January, at 2 a day
    });

    it("averages users over a bucket rather than summing them", () => {
        // Summing distinct-per-day counts would claim one person many times.
        const points = Array.from({ length: 200 }, (_, i) =>
            day(i, { activeUsers: 10 })
        );
        for (const value of toSparkSeries(points).activeUsers) {
            expect(value).toBe(10);
        }
    });

    it("rates uses per user off the folded totals", () => {
        const points = Array.from({ length: 200 }, (_, i) =>
            day(i, { inserts: 30, activeUsers: 10 })
        );
        for (const value of toSparkSeries(points).usesPerUser) {
            expect(value).toBe(3);
        }
    });

    it("reads a bucket with nobody in it as zero, not as a division", () => {
        const points = [day(0, { inserts: 5, activeUsers: 0 })];
        expect(toSparkSeries(points).usesPerUser).toEqual([0]);
    });

    it("returns empty arrays for an empty range", () => {
        expect(toSparkSeries([])).toEqual({
            inserts: [],
            activeUsers: [],
            usesPerUser: [],
            appOpens: []
        });
    });
});
