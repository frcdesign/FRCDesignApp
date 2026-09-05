import type { PeriodComparison } from "@backend/features/analytics/contract";

function ratio(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * One comparison divided by another. A rate is never more knowable than its
 * counts, so an unavailable term makes the rate unavailable for the same reason.
 */
export function perUnit(
    numerator: PeriodComparison,
    denominator: PeriodComparison
): PeriodComparison {
    const current = ratio(numerator.current, denominator.current);
    const previous = ratio(numerator.previous, denominator.previous);
    // Windows and their labels come from the numerator: dividing two measures
    // of the same window does not change which window it is.
    const base = { ...numerator, current, previous };

    const unavailable = numerator.unavailable ?? denominator.unavailable;
    if (unavailable) {
        return { ...base, changeRatio: null, unavailable };
    }
    if (previous === 0) {
        return {
            ...base,
            changeRatio: null,
            unavailable: current === 0 ? "no-activity" : "zero-baseline"
        };
    }
    return { ...base, changeRatio: (current - previous) / previous };
}
