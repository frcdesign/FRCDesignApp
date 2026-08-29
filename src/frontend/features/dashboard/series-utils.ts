import type { DailyInsertPoint } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import {
    formatBucket,
    pickGranularity,
    toBucketKey,
    type BucketPoint,
    type Granularity
} from "./buckets";

/** A bucket plus one numeric column per library, keyed by display name. */
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

/** Formats a count for the stat tiles, e.g. 12400 -> "12,400". */
export function formatCount(value: number): string {
    return new Intl.NumberFormat("en-US").format(value);
}

/** Formats part/total as a percentage, or a dash when there is no total. */
export function formatPercent(part: number, total: number): string {
    if (total === 0) return "—";
    return `${((part / total) * 100).toFixed(1)}%`;
}

/** Formats a "YYYY-MM-DD" day key as a short date. */
export function formatDay(day: string): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    });
}
