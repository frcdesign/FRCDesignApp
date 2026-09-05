/**
 * The windows the dashboard reports over, and the one rate it derives.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/** The trailing days each parts-table row's sparkline plots. */
export const SPARKLINE_DAYS = 30;

/**
 * The trailing window the recent comparisons cover. Shared with the dashboard,
 * whose heading is named from it and so cannot drift.
 */
export const RECENT_DAYS = 30;

/** The days a "month" stands for in the per-month usage rate. */
const MONTH_DAYS = 30;

/**
 * Inserts per month, so a new part is not buried under an old one. The span is
 * floored at a month, or a first week of 2 extrapolates to 60.
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
