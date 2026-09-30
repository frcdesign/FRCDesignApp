import { plural } from "./plural";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "just now", "5 minutes ago", "2 hours ago" — for something from today. */
export function formatTimeAgo(timestamp: number): string {
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed < MINUTE_MS) {
        return "just now";
    }
    if (elapsed < HOUR_MS) {
        return `${plural(Math.floor(elapsed / MINUTE_MS), "minute")} ago`;
    }
    return `${plural(Math.floor(elapsed / HOUR_MS), "hour")} ago`;
}

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
