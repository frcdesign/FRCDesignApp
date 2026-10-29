/** Imported by both sides, so nothing Worker-only. */

/** US teams work evenings, which UTC midnight would split. */
const REPORTING_TIME_ZONE = "America/New_York";

// en-CA gives YYYY-MM-DD. Built once, since construction is the expensive part.
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

/** Parsed at UTC midnight so every step is 24 hours. */
export function addDays(day: string, count: number): string {
    const at = Date.parse(`${day}T00:00:00Z`) + count * 24 * 3600 * 1000;
    return new Date(at).toISOString().slice(0, 10);
}

/** Yesterday: today is still filling, and would dip every chart. */
export function toReportingDay(timestamp: number): string {
    return addDays(toDayKey(timestamp), -1);
}

/** Both bounds inclusive, as every day key comparison here is. */
export interface DayRange {
    from: string;
    to: string;
}
