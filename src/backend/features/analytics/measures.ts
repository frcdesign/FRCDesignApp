/** Imported by both sides, so nothing Worker-only. */

/** The comparison window, a sparkline's length, and the span rates scale to. */
export const MONTH_DAYS = 30;

/** Floored at a month, or a first week of 2 extrapolates to 60. */
export function usesPerMonth(
    useCount: number,
    firstUsedAt: number | undefined,
    now: number
): number {
    if (useCount === 0 || firstUsedAt === undefined) return 0;
    const days = (now - firstUsedAt) / (24 * 3600 * 1000);
    return Math.round((useCount * MONTH_DAYS) / Math.max(days, MONTH_DAYS));
}
