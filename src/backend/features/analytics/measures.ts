/**
 * The windows the dashboard reports over, and the one rate it derives.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/** The trailing days each parts-table row's sparkline plots. */
export const SPARKLINE_DAYS = 30;

/**
 * The trailing window the recent comparisons cover.
 *
 * Lives here rather than beside the query so the dashboard can name its own
 * heading from it and never drift from the window it reports.
 */
export const RECENT_DAYS = 30;

/** The days a "month" stands for in the per-month usage rate. */
const MONTH_DAYS = 30;

/**
 * Inserts per month, normalized for how long a part has been in use so one
 * added recently is not buried under one that has been around for years.
 *
 * Called with the reported window's bounds, so `firstInsertedAt` is the later
 * of the part's first use and the window opening. The observed span is floored
 * at a month, so a part used twice in its first week reads as 2 rather than
 * being extrapolated to 60. Rounded, because a rate with decimals in it is
 * harder to scan than it is precise.
 */
export function usesPerMonth(
    insertCount: number,
    firstInsertedAt: number | null,
    now: number
): number {
    if (insertCount === 0 || firstInsertedAt === null) return 0;
    const days = (now - firstInsertedAt) / (24 * 3600 * 1000);
    return Math.round((insertCount * MONTH_DAYS) / Math.max(days, MONTH_DAYS));
}
