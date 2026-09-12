/**
 * The day key every rollup is keyed on, and the window a read covers.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/**
 * US teams work evenings, and a UTC midnight cuts that session in half: 8pm
 * Eastern is already tomorrow. Fixed, so an insert lands on one day for everyone.
 */
const REPORTING_TIME_ZONE = "America/New_York";

// en-CA formats as YYYY-MM-DD, which is the shape day keys are compared as.
// Built once: constructing a formatter per call is the expensive part.
const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

/** The day an instant fell on, in {@link REPORTING_TIME_ZONE}. */
export function toDayKey(timestamp: number): string {
    return dayFormat.format(timestamp);
}

/**
 * Steps a day key by whole days. A key is a calendar date, not an instant, so
 * parsing at UTC midnight keeps every step 24 hours — a DST zone would not.
 */
export function addDays(day: string, count: number): string {
    const at = Date.parse(`${day}T00:00:00Z`) + count * 24 * 3600 * 1000;
    return new Date(at).toISOString().slice(0, 10);
}

/** Both bounds inclusive, as every day key comparison here is. */
export interface DayRange {
    from: string;
    to: string;
}
