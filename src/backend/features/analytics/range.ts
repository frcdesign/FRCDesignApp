import { min } from "drizzle-orm";
import z from "zod";
import { type Db } from "../../db/client";
import { dailyMetrics } from "./schema";
import { addDays, toReportingDay, type DayRange } from "./day";

/** The uses a part must be at or below for the low-usage reports to list it. */
const DEFAULT_UNUSED_THRESHOLD = 5;

/** Only a hand-edited url reaches this. */
const MAX_SERIES_DAYS = 10 * 366;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const rangeQuery = z.object({ from: day, to: day });

/** A range, plus the cutoff the low-usage reports list at or below. */
export const thresholdQuery = rangeQuery.extend({
    threshold: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(DEFAULT_UNUSED_THRESHOLD)
});

/** Clamp `from` first, or "all time" fills two decades. */
export function eachDay(range: DayRange): string[] {
    const days: string[] = [];
    let day = range.from;
    while (day <= range.to && days.length < MAX_SERIES_DAYS) {
        days.push(day);
        day = addDays(day, 1);
    }
    return days;
}

/** Tells "nothing happened" from "not tracking yet". */
export async function getTrackingSince(db: Db): Promise<string | undefined> {
    const row = await db
        .select({ day: min(dailyMetrics.day) })
        .from(dailyMetrics)
        .get();
    return row?.day ?? undefined;
}

/** `to` is held to the last reported day, since today is still filling. */
export function clampRange(
    range: DayRange,
    since: string | undefined,
    latest: string = toReportingDay(Date.now())
): DayRange {
    const to = range.to > latest ? latest : range.to;
    if (since === undefined) return { from: to, to };
    return { from: range.from < since ? since : range.from, to };
}
