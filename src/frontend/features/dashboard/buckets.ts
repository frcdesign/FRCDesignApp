/**
 * Bucketing for the time-series charts.
 *
 * Chart points keep the raw bucket key alongside the formatted label, because
 * recharts matches a `ReferenceArea` against exact category values — season
 * bands can line up with "2026-01" but not with "Jan 2026".
 */

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
 * Picks a granularity from the span the days cover, not from how many there
 * are: a sparse three-year series has few points but must still bucket, or the
 * chart silently compresses its gaps.
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
