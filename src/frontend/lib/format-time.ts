/** Shared helpers for rendering timestamps and durations in the UI. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole elapsed days, not calendar days. */
export function formatDaysAgo(timestamp: number): string {
    const days = Math.floor((Date.now() - timestamp) / DAY_MS);
    if (days < 1) {
        return "Today";
    }
    if (days === 1) {
        return "Yesterday";
    }
    return `${days} days ago`;
}
