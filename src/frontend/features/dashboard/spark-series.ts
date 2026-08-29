import type { DailyMetricPoint } from "@backend/features/analytics/contract";
import { pickGranularity, toBucketKey } from "./buckets";

/** One array per top card, bucketed to the same resolution as the chart. */
export interface SparkSeries {
    inserts: number[];
    activeUsers: number[];
    usesPerUser: number[];
    appOpens: number[];
}

interface Bucket {
    inserts: number;
    activeUsers: number;
    appOpens: number;
    days: number;
}

/**
 * Daily points folded into the buckets the range implies.
 *
 * Left raw, two years of days is a hairy smear rather than a shape — the same
 * reason the chart below these cards buckets, and it uses the same rule so the
 * two agree on what a point means.
 *
 * Distinct-user counts are averaged over a bucket rather than summed, since one
 * person active all week is one user and not seven. Uses per user divides the
 * two folded totals, which is that same per-day average expressed as a rate.
 */
export function toSparkSeries(points: DailyMetricPoint[]): SparkSeries {
    const granularity = pickGranularity(points.map((point) => point.day));
    const buckets = new Map<string, Bucket>();

    for (const point of points) {
        const key = toBucketKey(point.day, granularity);
        const bucket = buckets.get(key) ?? {
            inserts: 0,
            activeUsers: 0,
            appOpens: 0,
            days: 0
        };
        bucket.inserts += point.inserts;
        bucket.activeUsers += point.activeUsers;
        bucket.appOpens += point.appOpens;
        bucket.days += 1;
        buckets.set(key, bucket);
    }

    const ordered = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, bucket]) => bucket);

    return {
        inserts: ordered.map((bucket) => bucket.inserts),
        activeUsers: ordered.map((bucket) => bucket.activeUsers / bucket.days),
        usesPerUser: ordered.map((bucket) =>
            bucket.activeUsers === 0 ? 0 : bucket.inserts / bucket.activeUsers
        ),
        appOpens: ordered.map((bucket) => bucket.appOpens)
    };
}
