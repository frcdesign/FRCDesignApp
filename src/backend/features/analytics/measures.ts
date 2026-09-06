/**
 * The windows the dashboard reports over, and the one rate it derives.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/**
 * What "a month" means throughout: the trailing window the recent comparisons
 * cover, the days a sparkline plots, and the span a usage rate is scaled to.
 * The dashboard names its own headings from it, so nothing can drift.
 */
export const MONTH_DAYS = 30;

/**
 * Inserts per month, so a new part is not buried under an old one. The span is
 * floored at a month, or a first week of 2 extrapolates to 60.
 */
export function usesPerMonth(
    insertCount: number,
    firstInsertedAt: number | undefined,
    now: number
): number {
    if (insertCount === 0 || firstInsertedAt === undefined) return 0;
    const days = (now - firstInsertedAt) / (24 * 3600 * 1000);
    return Math.round((insertCount * MONTH_DAYS) / Math.max(days, MONTH_DAYS));
}
