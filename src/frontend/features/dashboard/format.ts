/** How the dashboard spells a number, a share and a day. */

/** Stands in for a number there is no way to state. */
export const NO_VALUE = "—";

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
 * One number as a share of another. A total that is absent and one that is zero
 * read the same: there is nothing to take a share of either way.
 */
export function formatShare(part: number, total: number | undefined): string {
    if (!total) return NO_VALUE;
    return formatPercent((part / total) * 100);
}

/** Formats a "YYYY-MM-DD" day key as a short date. */
export function formatDay(day: string): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    });
}
