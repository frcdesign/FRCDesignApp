const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** Largest first; the first one the elapsed time reaches is the one used. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", DAY_MS],
    ["hour", HOUR_MS],
    ["minute", MINUTE_MS]
];

/** Anything older reads better as a date than as a count of days. */
const MAX_RELATIVE_DAYS = 7;

/** "just now", "5 minutes ago", "yesterday", "3 days ago", then a date. */
export function formatTimeAgo(timestamp: number): string {
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed >= MAX_RELATIVE_DAYS * DAY_MS) {
        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }
    for (const [unit, unitMs] of UNITS) {
        const count = Math.floor(elapsed / unitMs);
        if (count >= 1) {
            return RELATIVE.format(-count, unit);
        }
    }
    return "just now";
}

/** {@link formatTimeAgo} standing on its own rather than ending a sentence. */
export function formatTimeAgoLabel(timestamp: number): string {
    const text = formatTimeAgo(timestamp);
    return text.charAt(0).toUpperCase() + text.slice(1);
}
