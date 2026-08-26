import type { DailyInsertPoint } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";

/** Above this many days, daily points are bucketed by month to stay readable. */
const MONTHLY_BUCKET_THRESHOLD = 120;

export interface ChartPoint {
    date: string;
    [libraryName: string]: string | number;
}

/**
 * Flattens the API's per-day/per-library counts into the one-record-per-x-value
 * shape charts expect, keyed by library display name so the legend reads well.
 */
export function toChartData(
    series: DailyInsertPoint[],
    libraryIds: LibraryId[]
): ChartPoint[] {
    const bucketed = shouldBucketByMonth(series);

    const totals = new Map<string, Map<LibraryId, number>>();
    for (const point of series) {
        const key = bucketed ? point.day.slice(0, 7) : point.day;
        const counts = totals.get(key) ?? new Map<LibraryId, number>();
        for (const [libraryId, count] of Object.entries(point.counts)) {
            const id = libraryId as LibraryId;
            counts.set(id, (counts.get(id) ?? 0) + (count ?? 0));
        }
        totals.set(key, counts);
    }

    return [...totals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, counts]) => {
            const point: ChartPoint = { date: formatBucket(date, bucketed) };
            // Every series needs a value on every point, or lines break up.
            for (const libraryId of libraryIds) {
                point[getLibraryName(libraryId)] = counts.get(libraryId) ?? 0;
            }
            return point;
        });
}

function shouldBucketByMonth(series: { length: number }): boolean {
    return series.length > MONTHLY_BUCKET_THRESHOLD;
}

function formatBucket(date: string, bucketed: boolean): string {
    const parsed = new Date(bucketed ? `${date}-01` : date);
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        ...(bucketed ? { year: "numeric" } : { day: "numeric" }),
        timeZone: "UTC"
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

/** Formats an epoch timestamp as a short date, or a dash when never used. */
export function formatDate(timestamp: number | null): string {
    if (timestamp === null) return "—";
    return new Date(timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}
