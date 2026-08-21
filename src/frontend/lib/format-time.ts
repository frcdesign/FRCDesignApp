/** Shared helpers for rendering timestamps and durations in the UI. */

const RELATIVE = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
    style: "narrow"
});

/** Largest unit first; the first one the elapsed time reaches is the one used. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60]
];

/** Anything older reads better as a date than as a count of days. */
const MAX_RELATIVE_DAYS = 7;

/**
 * A short, localized relative time like "just now", "5 min ago", "yesterday",
 * falling back to a locale date for anything older than a week.
 */
export function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds >= MAX_RELATIVE_DAYS * 24 * 60 * 60) {
        return new Date(timestamp).toLocaleDateString();
    }
    for (const [unit, unitSeconds] of UNITS) {
        const elapsed = Math.floor(seconds / unitSeconds);
        if (elapsed >= 1) {
            return RELATIVE.format(-elapsed, unit);
        }
    }
    return "just now";
}
