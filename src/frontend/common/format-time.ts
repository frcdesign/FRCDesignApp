/** Shared helpers for rendering timestamps and durations in the UI. */

/**
 * A short, human relative time like "just now", "5m ago", "3h ago", "2d ago",
 * falling back to a locale date for anything older than a week.
 */
export function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

/** A compact elapsed duration like "45s", "3m 12s", or "1h 20m". */
export function formatDuration(startMs: number, endMs: number): string {
    const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}
