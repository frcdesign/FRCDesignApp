import { describe, expect, it } from "vitest";
import type { DailyMetricPoint } from "@backend/features/analytics/contract";
import { toSparkSeries } from "./spark-series";

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
