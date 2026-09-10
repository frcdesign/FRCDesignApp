/**
 * The day key every rollup is keyed on, and the window a read covers.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/** Formats an epoch timestamp as the UTC `YYYY-MM-DD` day key. */
export function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

/** Both bounds inclusive, as every day key comparison here is. */
export interface DayRange {
    from: string;
    to: string;
}
