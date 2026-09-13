/** Shared helpers for rendering timestamps and durations in the UI. */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long ago, counted in whole elapsed days rather than calendar ones — this
 * says how stale a load is, which no clock boundary changes.
 */
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
