import { describe, expect, it } from "vitest";
import {
    type DailyMetricPoint,
    type UseTargets
} from "@backend/features/analytics/contract";
import { UseTarget } from "@backend/features/analytics/usage";
import {
    METRICS,
    isPercentage,
    rangeTerms,
    rangeValue,
    toTrend
} from "./metrics";

/** A day's uses split by where they went. */
function targets(
    partStudio: number,
    assembly: number,
    download = 0
): UseTargets {
    return {
        [UseTarget.PART_STUDIO]: partStudio,
        [UseTarget.ASSEMBLY]: assembly,
        [UseTarget.DOWNLOAD]: download
    };
}

function day(index: number, overrides: Partial<DailyMetricPoint> = {}) {
    const date = new Date(Date.UTC(2026, 0, 1 + index));
    return {
        day: date.toISOString().slice(0, 10),
        uses: 0,
        appOpens: 0,
        activeUsers: 0,
        favoriteUses: 0,
        quickInserts: 0,
        fastenInserts: 0,
        // Every use a part-studio insert, unless a test splits them itself.
        targets: targets(overrides.uses ?? 0, 0),
        ...overrides
    };
}

describe("metric definitions", () => {
    it("marks exactly the ratio metrics as percentages", () => {
        const percentages = Object.values(METRICS)
            .filter(isPercentage)
            .map((metric) => metric.key);
        expect(percentages.sort()).toEqual([
            "assemblyFraction",
            "downloadFraction",
            "fastenFraction",
            "quickFraction"
        ]);
    });

    it("measures quick insert against inserts, leaving downloads out", () => {
        const [point] = toTrend(
            [day(0, { uses: 10, quickInserts: 2, targets: targets(4, 4, 2) })],
            METRICS.quickFraction
        );
        expect(point.value).toBe(25);
    });

    it("measures downloads against every use", () => {
        const [point] = toTrend(
            [day(0, { uses: 10, targets: targets(4, 4, 2) })],
            METRICS.downloadFraction
        );
        expect(point.value).toBe(20);
    });

    it("measures fasten against assembly inserts", () => {
        // Only an assembly insert can fasten.
        const [point] = toTrend(
            [
                day(0, {
                    uses: 40,
                    fastenInserts: 4,
                    targets: targets(24, 16)
                })
            ],
            METRICS.fastenFraction
        );
        expect(point.value).toBe(25);
    });
});

describe("toTrend", () => {
    it("returns a count metric's daily totals", () => {
        const trend = toTrend(
            [day(0, { uses: 3 }), day(1, { uses: 5 })],
            METRICS.uses
        );
        expect(trend.map((point) => point.value)).toEqual([3, 5]);
    });

    it("turns a share into a percentage per day", () => {
        const trend = toTrend(
            [
                day(0, { uses: 10, quickInserts: 3 }),
                day(1, { uses: 4, quickInserts: 1 })
            ],
            METRICS.quickFraction
        );
        expect(trend.map((point) => point.value)).toEqual([30, 25]);
    });

    it("ratios a month from its totals, not by averaging daily rates", () => {
        // A quiet 1-of-1 day beside many busy 0-of-99 days is ~1%, not ~50%.
        const points = [
            day(0, { uses: 1, quickInserts: 1 }),
            ...Array.from({ length: 200 }, (_, index) =>
                day(index + 1, { uses: 99, quickInserts: 0 })
            )
        ];
        const [first] = toTrend(points, METRICS.quickFraction);
        expect(first.value).toBeLessThan(1);
    });

    it("keeps a short range at daily resolution", () => {
        const points = Array.from({ length: 30 }, (_, index) =>
            day(index, { uses: 1 })
        );
        expect(toTrend(points, METRICS.uses)).toHaveLength(30);
    });

    it("buckets a year by week and a longer span by month", () => {
        const daily = (length: number) =>
            Array.from({ length }, (_, index) => day(index, { uses: 1 }));

        const year = toTrend(daily(365), METRICS.uses);
        expect(year).toHaveLength(53);
        // 2026-01-01 is a Thursday, so the first week is a stub of 4 days.
        expect(year[0]).toEqual({
            bucket: "2025-12-29",
            label: "Dec 29",
            value: 4
        });

        const longer = toTrend(daily(800), METRICS.uses);
        expect(longer[0]).toEqual({
            bucket: "2026-01",
            label: "Jan 2026",
            value: 31
        });
    });

    it("reports zero rather than dividing by zero", () => {
        const [point] = toTrend([day(0)], METRICS.quickFraction);
        expect(point.value).toBe(0);
    });

    it("returns nothing for an empty series", () => {
        expect(toTrend([], METRICS.uses)).toEqual([]);
    });
});

describe("rangeValue", () => {
    // The property that keeps a tile from disagreeing with its own chart.
    it("folds the same points the trend plots, for every metric", () => {
        const points = [
            day(0, {
                uses: 10,
                appOpens: 4,
                activeUsers: 6,
                favoriteUses: 5,
                quickInserts: 2,
                fastenInserts: 1,
                targets: targets(6, 4)
            }),
            day(1, {
                uses: 30,
                appOpens: 6,
                activeUsers: 8,
                favoriteUses: 5,
                quickInserts: 8,
                fastenInserts: 3,
                targets: targets(24, 6)
            })
        ];

        for (const metric of Object.values(METRICS)) {
            const value = rangeValue(points, metric);
            const trend = toTrend(points, metric).map((point) => point.value);
            const [low, high] = [Math.min(...trend), Math.max(...trend)];

            // A fold of the plotted values must land within them.
            expect(value, metric.key).toBeGreaterThanOrEqual(
                isPercentage(metric) ? low : high
            );
            if (isPercentage(metric)) {
                expect(value, metric.key).toBeLessThanOrEqual(high);
            }
        }
    });

    it("sums a count across the range", () => {
        const value = rangeValue(
            [day(0, { uses: 10 }), day(1, { uses: 30 })],
            METRICS.uses
        );
        expect(value).toBe(40);
    });

    it("ratios a share from range totals, not from daily rates", () => {
        const value = rangeValue(
            [
                day(0, { uses: 1, quickInserts: 1 }),
                day(1, { uses: 99, quickInserts: 0 })
            ],
            METRICS.quickFraction
        );
        expect(value).toBeCloseTo(1, 1);
    });

    it("reports zero for an empty range", () => {
        expect(rangeValue([], METRICS.uses)).toBe(0);
        expect(rangeValue([], METRICS.quickFraction)).toBe(0);
    });
});

describe("rangeTerms", () => {
    it("returns the numbers the share is divided from", () => {
        const points = [
            day(0, { uses: 10, quickInserts: 3 }),
            day(1, { uses: 30, quickInserts: 7 })
        ];

        expect(rangeTerms(points, METRICS.quickFraction)).toEqual({
            numerator: 10,
            denominator: 40
        });
        // Those terms are exactly what the displayed value divides.
        expect(rangeValue(points, METRICS.quickFraction)).toBeCloseTo(25, 5);
    });

    it("leaves the denominator at zero for a count", () => {
        expect(rangeTerms([day(0, { uses: 5 })], METRICS.uses)).toEqual({
            numerator: 5,
            denominator: 0
        });
    });
});
