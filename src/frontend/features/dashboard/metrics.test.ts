import { describe, expect, it } from "vitest";
import type { DailyMetricPoint } from "@backend/features/analytics/contract";
import { METRICS, isShare, rangeTerms, rangeValue, toTrend } from "./metrics";

function day(index: number, overrides: Partial<DailyMetricPoint> = {}) {
    const date = new Date(Date.UTC(2026, 0, 1 + index));
    return {
        day: date.toISOString().slice(0, 10),
        inserts: 0,
        appOpens: 0,
        activeUsers: 0,
        favoriteInserts: 0,
        quickInserts: 0,
        fastenInserts: 0,
        assemblyInserts: 0,
        ...overrides
    };
}

describe("metric definitions", () => {
    it("marks exactly the ratio metrics as shares", () => {
        const shares = Object.values(METRICS)
            .filter(isShare)
            .map((metric) => metric.key);
        expect(shares.sort()).toEqual([
            "deriveShare",
            "fastenShare",
            "quickShare"
        ]);
    });

    it("measures fasten against assembly inserts", () => {
        // The one metric with a denominator other than total inserts.
        const [point] = toTrend(
            [day(0, { inserts: 40, fastenInserts: 4, assemblyInserts: 16 })],
            METRICS.fastenShare
        );
        expect(point.value).toBe(25);
    });
});

describe("toTrend", () => {
    it("returns a count metric's daily totals", () => {
        const trend = toTrend(
            [day(0, { inserts: 3 }), day(1, { inserts: 5 })],
            METRICS.inserts
        );
        expect(trend.map((point) => point.value)).toEqual([3, 5]);
    });

    it("turns a share into a percentage per day", () => {
        const trend = toTrend(
            [
                day(0, { inserts: 10, quickInserts: 3 }),
                day(1, { inserts: 4, quickInserts: 1 })
            ],
            METRICS.quickShare
        );
        expect(trend.map((point) => point.value)).toEqual([30, 25]);
    });

    it("ratios a month from its totals, not by averaging daily rates", () => {
        // A quiet 1-of-1 day beside many busy 0-of-99 days is ~1%, not ~50%.
        const points = [
            day(0, { inserts: 1, quickInserts: 1 }),
            ...Array.from({ length: 200 }, (_, index) =>
                day(index + 1, { inserts: 99, quickInserts: 0 })
            )
        ];
        const [first] = toTrend(points, METRICS.quickShare);
        expect(first.value).toBeLessThan(1);
    });

    it("averages active users over a bucket rather than summing them", () => {
        // Summing distinct-per-day counts would count one person many times.
        const points = Array.from({ length: 200 }, (_, index) =>
            day(index, { activeUsers: 10 })
        );
        for (const point of toTrend(points, METRICS.activeUsers)) {
            expect(point.value).toBe(10);
        }
    });

    it("keeps a short range at daily resolution", () => {
        const points = Array.from({ length: 30 }, (_, index) =>
            day(index, { inserts: 1 })
        );
        expect(toTrend(points, METRICS.inserts)).toHaveLength(30);
    });

    it("buckets a long range by month", () => {
        const points = Array.from({ length: 365 }, (_, index) =>
            day(index, { inserts: 1 })
        );
        const trend = toTrend(points, METRICS.inserts);

        expect(trend).toHaveLength(12);
        expect(trend[0]).toEqual({
            bucket: "2026-01",
            label: "Jan 2026",
            value: 31
        });
    });

    it("reports zero rather than dividing by zero", () => {
        const [point] = toTrend([day(0)], METRICS.quickShare);
        expect(point.value).toBe(0);
    });

    it("returns nothing for an empty series", () => {
        expect(toTrend([], METRICS.inserts)).toEqual([]);
    });
});

describe("rangeValue", () => {
    // The property that keeps a tile from disagreeing with its own chart.
    it("folds the same points the trend plots, for every metric", () => {
        const points = [
            day(0, {
                inserts: 10,
                appOpens: 4,
                activeUsers: 6,
                favoriteInserts: 5,
                quickInserts: 2,
                fastenInserts: 1,
                assemblyInserts: 4
            }),
            day(1, {
                inserts: 30,
                appOpens: 6,
                activeUsers: 8,
                favoriteInserts: 5,
                quickInserts: 8,
                fastenInserts: 3,
                assemblyInserts: 6
            })
        ];

        for (const metric of Object.values(METRICS)) {
            const value = rangeValue(points, metric);
            const trend = toTrend(points, metric).map((point) => point.value);
            const [low, high] = [Math.min(...trend), Math.max(...trend)];

            // A fold of the plotted values must land within them.
            expect(value, metric.key).toBeGreaterThanOrEqual(
                metric.aggregate === "average" || isShare(metric) ? low : high
            );
            if (metric.aggregate === "average" || isShare(metric)) {
                expect(value, metric.key).toBeLessThanOrEqual(high);
            }
        }
    });

    it("sums a count across the range", () => {
        const value = rangeValue(
            [day(0, { inserts: 10 }), day(1, { inserts: 30 })],
            METRICS.inserts
        );
        expect(value).toBe(40);
    });

    it("averages active users rather than summing them", () => {
        // Summing would claim 14 people when at most 8 were ever seen in a day.
        const value = rangeValue(
            [day(0, { activeUsers: 6 }), day(1, { activeUsers: 8 })],
            METRICS.activeUsers
        );
        expect(value).toBe(7);
    });

    it("ratios a share from range totals, not from daily rates", () => {
        const value = rangeValue(
            [
                day(0, { inserts: 1, quickInserts: 1 }),
                day(1, { inserts: 99, quickInserts: 0 })
            ],
            METRICS.quickShare
        );
        expect(value).toBeCloseTo(1, 1);
    });

    it("reports zero for an empty range", () => {
        expect(rangeValue([], METRICS.inserts)).toBe(0);
        expect(rangeValue([], METRICS.activeUsers)).toBe(0);
        expect(rangeValue([], METRICS.quickShare)).toBe(0);
    });
});

describe("metric descriptions", () => {
    it("names a denominator for exactly the shares", () => {
        for (const metric of Object.values(METRICS)) {
            expect(!!metric.denominatorLabel, metric.key).toBe(isShare(metric));
        }
    });

    it("gives every metric a description and a numerator label", () => {
        for (const metric of Object.values(METRICS)) {
            expect(metric.description.length, metric.key).toBeGreaterThan(40);
            expect(metric.numeratorLabel, metric.key).toBeTruthy();
        }
    });
});

describe("rangeTerms", () => {
    it("returns the numbers the share is divided from", () => {
        const points = [
            day(0, { inserts: 10, quickInserts: 3 }),
            day(1, { inserts: 30, quickInserts: 7 })
        ];

        expect(rangeTerms(points, METRICS.quickShare)).toEqual({
            numerator: 10,
            denominator: 40
        });
        // Those terms are exactly what the displayed value divides.
        expect(rangeValue(points, METRICS.quickShare)).toBeCloseTo(25, 5);
    });

    it("leaves the denominator at zero for a count", () => {
        expect(rangeTerms([day(0, { inserts: 5 })], METRICS.inserts)).toEqual({
            numerator: 5,
            denominator: 0
        });
    });
});
