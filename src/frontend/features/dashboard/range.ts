import { toDayKey, type DayRange } from "./dashboard-queries";

/** Selectable windows, widest first so the default sits at the near end. */
export const RANGE_PRESETS = {
    all: { label: "All time", days: null },
    "1y": { label: "1 year", days: 365 },
    "90d": { label: "90 days", days: 90 },
    "30d": { label: "30 days", days: 30 },
    "7d": { label: "7 days", days: 7 }
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

export const DEFAULT_RANGE_PRESET: RangePreset = "all";

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
