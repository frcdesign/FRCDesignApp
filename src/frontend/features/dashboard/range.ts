import { toDayKey, type DayRange } from "./dashboard-queries";

/** Selectable windows for the range chart. */
export const RANGE_PRESETS = {
    "7d": { label: "7 days", days: 7 },
    "30d": { label: "30 days", days: 30 },
    "90d": { label: "90 days", days: 90 },
    "1y": { label: "1 year", days: 365 },
    all: { label: "All time", days: null }
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

export const DEFAULT_RANGE_PRESET: RangePreset = "30d";

export function isRangePreset(value: unknown): value is RangePreset {
    return typeof value === "string" && value in RANGE_PRESETS;
}

/** Resolves a preset to the concrete day bounds the API expects. */
export function toDayRange(preset: RangePreset): DayRange {
    const now = Date.now();
    const { days } = RANGE_PRESETS[preset];
    return {
        // The app has no data before 2026, so "all time" just reaches back far.
        from:
            days === null
                ? "2000-01-01"
                : toDayKey(now - days * 24 * 3600 * 1000),
        to: toDayKey(now)
    };
}
