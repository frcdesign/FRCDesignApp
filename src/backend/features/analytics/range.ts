/**
 * The window a dashboard read covers, and the days it spans.
 */
import { min } from "drizzle-orm";
import z from "zod";
import { type Db } from "../../db/client";
import { dailyMetrics } from "./schema";
import { addDays, toDayKey, type DayRange } from "./day";

/** The uses a part must be at or below for the low-usage reports to list it. */
const DEFAULT_UNUSED_THRESHOLD = 5;

/**
 * The most days one densified series may cover. Only a hand-edited url reaches
 * it: the app asks for at most the days since tracking began.
 */
const MAX_SERIES_DAYS = 10 * 366;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Both bounds are required: every page states the window it reports, so a
 * missing one is the caller's bug.
 */
export const rangeQuery = z.object({ from: day, to: day });

/** A range, plus the cutoff the low-usage reports list at or below. */
export const thresholdQuery = rangeQuery.extend({
    threshold: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(DEFAULT_UNUSED_THRESHOLD)
});

/**
 * Every day in the range, inclusive. Clamp `from` to the first recorded day
 * first, or "all time" fills two decades of zeroes. Capped as well as clamped,
 * since the allocation happens here: the bound is what a caller asked for.
 */
export function eachDay(range: DayRange): string[] {
    const days: string[] = [];
    let day = range.from;
    while (day <= range.to && days.length < MAX_SERIES_DAYS) {
        days.push(day);
        day = addDays(day, 1);
    }
    return days;
}

/**
 * The first day anything was recorded, which is what tells "nothing happened"
 * from "we were not tracking yet".
 */
export async function getTrackingSince(db: Db): Promise<string | undefined> {
    const row = await db
        .select({ day: min(dailyMetrics.day) })
        .from(dailyMetrics)
        .get();
    return row?.day ?? undefined;
}

/**
 * Narrows a requested range to the days actually covered by tracking. `to` is
 * held to today as well: nothing was recorded tomorrow, and an unclamped one is
 * a request to densify a point per day until whatever year was asked for.
 */
export function clampRange(
    range: DayRange,
    since: string | undefined,
    today: string = toDayKey(Date.now())
): DayRange {
    const to = range.to > today ? today : range.to;
    if (since === undefined) return { from: to, to };
    return { from: range.from < since ? since : range.from, to };
}
