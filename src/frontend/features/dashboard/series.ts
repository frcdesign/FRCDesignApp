/**
 * Every series the dashboard plots, and the bucketing they share. Points keep
 * the raw key beside the label: a reference line matches "2026-01", not "Jan 2026".
 */

import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";

/** Above this many days, points are bucketed by month to stay readable. */
const MONTHLY_BUCKET_DAYS = 120;

export type Granularity = "day" | "week" | "month";

export interface BucketPoint {
    /** The raw key, "YYYY-MM-DD" or "YYYY-MM". What bands match against. */
    bucket: string;
    /** The tick label, e.g. "Mar 4" or "Mar 2026". */
    label: string;
}

/**
 * From the span the days cover, not how many there are: a sparse three-year
 * series has few points but must still bucket, or its gaps compress silently.
 */
export function pickGranularity(days: string[]): Granularity {
    if (days.length === 0) return "day";
    let first = days[0];
    let last = days[0];
    for (const day of days) {
        if (day < first) first = day;
        if (day > last) last = day;
    }
    return spanInDays(first, last) > MONTHLY_BUCKET_DAYS ? "month" : "day";
}

/** Inclusive day count between two "YYYY-MM-DD" keys. */
export function spanInDays(from: string, to: string): number {
    const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    return Math.round(ms / (24 * 3600 * 1000)) + 1;
}

/** The Monday on or before `day`, so a week is not split across two buckets. */
function weekStart(day: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
}

export function toBucketKey(day: string, granularity: Granularity): string {
    switch (granularity) {
        case "month":
            return day.slice(0, 7);
        case "week":
            return weekStart(day);
        case "day":
            return day;
    }
}

export function formatBucket(bucket: string, granularity: Granularity): string {
    const monthly = granularity === "month";
    const parsed = new Date(monthly ? `${bucket}-01` : bucket);
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        ...(monthly ? { year: "numeric" } : { day: "numeric" }),
        timeZone: "UTC"
    });
}

export type ChartPoint = BucketPoint & Record<string, string | number>;

/**
 * Flattens the API's per-day/per-library counts into the one-record-per-x-value
 * shape charts expect, keyed by library display name so the legend reads well.
 */
export function toChartData(
    series: DailyInsertPoint[],
    libraryIds: LibraryId[],
    granularity: Granularity = pickGranularity(series.map((p) => p.day))
): ChartPoint[] {
    const totals = new Map<string, Map<LibraryId, number>>();
    for (const point of series) {
        const key = toBucketKey(point.day, granularity);
        const counts = totals.get(key) ?? new Map<LibraryId, number>();
        for (const [libraryId, count] of Object.entries(point.counts)) {
            const id = libraryId as LibraryId;
            counts.set(id, (counts.get(id) ?? 0) + (count ?? 0));
        }
        totals.set(key, counts);
    }

    return [...totals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, counts]) => {
            const point: ChartPoint = {
                bucket,
                label: formatBucket(bucket, granularity)
            };
            // Every series needs a value on every point, or lines break up.
            for (const libraryId of libraryIds) {
                point[getLibraryName(libraryId)] = counts.get(libraryId) ?? 0;
            }
            return point;
        });
}

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
 * Folded by the chart's own rule, since two years of raw days is a smear. Users
 * are averaged over a bucket, not summed: one person all week is one user.
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
