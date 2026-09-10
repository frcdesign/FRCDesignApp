/**
 * The day key every rollup is keyed on, and the window a read covers.
 *
 * Imported by both sides, so it stays free of anything Worker-only.
 */

/**
 * The zone a day key is measured in. The audience is US school and robotics
 * teams, who work evenings: a UTC midnight cuts a build session in half, since
 * 8pm Eastern is already tomorrow. Fixed rather than per-viewer, so one insert
 * lands on one day no matter who reports on it.
 */
export const REPORTING_TIME_ZONE = "America/New_York";

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
 * Steps a day key by whole days. A day key is a calendar date, not an instant,
 * so this is arithmetic on the date: parsing at UTC midnight keeps every step
 * exactly 24 hours, which no zone with a DST shift would.
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
