import { toDayKey, type DayRange } from "./dashboard-queries";

export enum RangePreset {
    ALL = "all",
    YEAR = "1y",
    DAYS_90 = "90d",
    DAYS_30 = "30d",
    DAYS_7 = "7d"
}

/** Selectable windows, widest first so the default sits at the near end. */
export const RANGE_PRESETS: Record<
    RangePreset,
    { label: string; days?: number }
> = {
    [RangePreset.ALL]: { label: "All time" },
    [RangePreset.YEAR]: { label: "1 year", days: 365 },
    [RangePreset.DAYS_90]: { label: "90 days", days: 90 },
    [RangePreset.DAYS_30]: { label: "30 days", days: 30 },
    [RangePreset.DAYS_7]: { label: "7 days", days: 7 }
};

export const DEFAULT_RANGE_PRESET = RangePreset.ALL;

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
            days === undefined
                ? "2000-01-01"
                : toDayKey(now - days * 24 * 3600 * 1000),
        to: toDayKey(now)
    };
}
