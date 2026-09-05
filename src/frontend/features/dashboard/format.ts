/** How the dashboard spells a number, a share and a day. */

/** Formats a count for the stat tiles, e.g. 12400 -> "12,400". */
export function formatCount(value: number): string {
    return new Intl.NumberFormat("en-US").format(value);
}

/** Formats part/total as a percentage, or a dash when there is no total. */
export function formatPercent(part: number, total: number): string {
    if (total === 0) return "—";
    return `${((part / total) * 100).toFixed(1)}%`;
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
