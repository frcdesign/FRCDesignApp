/**
 * The window a dashboard read covers, and the days it spans.
 */
import { min } from "drizzle-orm";
import z from "zod";
import { type AppContext } from "../../lib/context";
import { type Db } from "../../db/client";
import { dailyMetrics } from "../../db/schema";
import { toDayKey } from "./tracking";
import { internalError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";

export interface DayRange {
    from: string;
    to: string;
}

/**
 * The window a request asks for.
 *
 * Both bounds are required: every page states the window it reports, so a
 * missing one is a caller's bug rather than a reason to invent a default and
 * report something nobody asked for.
 */
export function getRange(c: AppContext): DayRange {
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = z
        .object({ from: day, to: day })
        .safeParse({ from: c.req.query("from"), to: c.req.query("to") });

    if (!parsed.success) {
        throw internalError(
            "A from and to day are required",
            HttpStatus.BAD_REQUEST
        );
    }
    return parsed.data;
}

/**
 * Every day in the range, inclusive.
 *
 * Callers must clamp `from` to the first recorded day first: the "all time"
 * preset reaches back to 2000, and filling two decades of zeroes would dwarf
 * the data it surrounds.
 */
export function eachDay(range: DayRange): string[] {
    const days: string[] = [];
    const last = Date.parse(`${range.to}T00:00:00Z`);
    for (
        let at = Date.parse(`${range.from}T00:00:00Z`);
        at <= last;
        at += 24 * 3600 * 1000
    ) {
        days.push(toDayKey(at));
    }
    return days;
}

/**
 * The first day anything was recorded, so a range can be clamped to the
 * history that exists and a caller can tell "nothing happened" from "we were
 * not tracking yet".
 */
export async function getTrackingSince(db: Db): Promise<string | null> {
    const row = await db
        .select({ day: min(dailyMetrics.day) })
        .from(dailyMetrics)
        .get();
    return row?.day ?? null;
}

/** Narrows a requested range to the days actually covered by tracking. */
export function clampRange(range: DayRange, since: string | null): DayRange {
    if (since === null) return { from: range.to, to: range.to };
    return { from: range.from < since ? since : range.from, to: range.to };
}
