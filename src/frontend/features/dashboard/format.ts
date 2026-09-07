/** How the dashboard spells a number and a fraction of one. */

/** Stands in for a number there is no way to state. */
const NO_VALUE = "—";

/** Formats a count for the stat tiles, e.g. 12400 -> "12,400". */
export function formatCount(value: number | undefined): string {
    if (value === undefined) return NO_VALUE;
    return new Intl.NumberFormat("en-US").format(value);
}

/** Formats a percentage that is already worked out, e.g. 37.5 -> "37.5%". */
export function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
}

/**
 * One number as a fraction of another. A total that is absent and one that is
 * zero read the same: there is nothing to take a fraction of either way.
 */
export function formatFraction(
    part: number,
    total: number | undefined
): string {
    if (!total) return NO_VALUE;
    return formatPercent((part / total) * 100);
}
