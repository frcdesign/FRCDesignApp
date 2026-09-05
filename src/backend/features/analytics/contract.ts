import { LibraryId } from "../library/library-id";
import { InsertSource } from "./events";

/** Lifetime counts, either overall or scoped to one library. */
export interface AnalyticsTotals {
    inserts: number;
    appOpens: number;
    uniqueUsers: number;
    /** Subsets of `inserts`; divide by it for the percentages. */
    favoriteInserts: number;
    quickInserts: number;
    /**
     * Insert-and-fasten, which Onshape only offers on an assembly target — so
     * its denominator is `assemblyInserts`, not `inserts`.
     */
    fastenInserts: number;
    assemblyInserts: number;
    /**
     * Favorites standing right now, not over the range: a favorite is state a
     * user keeps, not an event, so it has no day to be windowed by.
     */
    favorites: number;
}

/** One day of the range chart; `counts` is keyed by library id. */
export interface DailyInsertPoint {
    day: string;
    counts: Partial<Record<LibraryId, number>>;
}

/**
 * One day of every tracked metric, as raw counts. One series backs every trend,
 * so a tile and the chart behind it cannot disagree.
 */
export interface DailyMetricPoint {
    day: string;
    inserts: number;
    appOpens: number;
    /** Distinct users active that day; not summable across days. */
    activeUsers: number;
    favoriteInserts: number;
    quickInserts: number;
    fastenInserts: number;
    /** The denominator for `fastenInserts` on this day. */
    assemblyInserts: number;
}

/** Lifetime inserts started from one part of the app. */
export interface InsertSourceUsage {
    source: InsertSource;
    count: number;
    /** How many of those used the context-menu quick insert. */
    quickInsertCount: number;
}

/**
 * Severity counts are of issues, not items — one part with three warnings is
 * three — while `healthyItems` counts items, as the two counts above it do.
 */
export interface LibraryHealthCounts {
    groupCount: number;
    insertableCount: number;
    errorCount: number;
    warningCount: number;
    healthyItems: number;
}

export interface LibrarySummary {
    libraryId: LibraryId;
    totals: AnalyticsTotals;
    health: LibraryHealthCounts;
}

/** One measure over a window and the matching earlier window. */
export interface PeriodComparison {
    current: number;
    previous: number;
    /** Null whenever stating a change would be dishonest; see `unavailable`. */
    changeRatio: number | null;
    /** Why there is no change to state: an unmeasured baseline, two empty
     * windows, or an empty baseline, which reads as new rather than infinite. */
    unavailable?:
        | "no-prior-data"
        | "partial-prior-data"
        | "no-activity"
        | "zero-baseline";
    currentFrom: string;
    currentTo: string;
    previousFrom: string;
    previousTo: string;
    /** "FRC 2027 so far" / "FRC 2026 at the same point", for the tooltip. */
    label: string;
    baselineLabel: string;
    /** "last season" / "28 days" — the chip on the card, where space is out. */
    baselineShort: string;
}

/** The measures reported both as a trailing window and season over season. */
export type GrowthMeasure = "inserts" | "activeUsers" | "appOpens";

export interface GrowthOut {
    /** Trailing windows, which are meaningful from the first month. */
    recent: Record<GrowthMeasure, PeriodComparison>;
    /** Season to date against the same stretch of the season before. */
    season: Record<GrowthMeasure, PeriodComparison>;
    trackingSince: string | null;
}

/**
 * What one library's page reads. Narrower than the app overview it used to
 * share a type with, which had every library page paying for unopened fields.
 */
export interface LibrarySummaryOut {
    /** Lifetime, for the headline cards. */
    totals: AnalyticsTotals;
    /** Scoped to the requested range, for the chart and the sparklines. */
    metricSeries: DailyMetricPoint[];
    growth: GrowthOut;
    trackingSince: string | null;
    from: string;
    to: string;
}

export interface AnalyticsOverviewOut {
    /** Lifetime totals, shown as context beneath each tile's range value. */
    totals: AnalyticsTotals;
    libraries: LibrarySummary[];
    /** Per-library daily inserts, for the inserts tile's split-out detail. */
    series: DailyInsertPoint[];
    metricSeries: DailyMetricPoint[];
    sources: InsertSourceUsage[];
    from: string;
    to: string;
    /** The first day anything was recorded; null before any event. */
    trackingSince: string | null;
    growth: GrowthOut;
}

/** A row of the parts table. Only parts still in the library are listed. */
export interface PartUsageOut {
    elementId: string;
    insertableId: string;
    name: string;
    groupName: string;
    documentId: string;
    versionId: string;
    /** Hidden parts stay listed: they are in the library, just not insertable. */
    isVisible: boolean;
    /** Inserts inside the reported window; 0 for a part unused in it. */
    insertCount: number;
    /** The window's inserts scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    /** Daily inserts over a trailing {@link SPARKLINE_DAYS}, oldest first: a
     * shape rather than the reported window, which can be years of smear. */
    recent: number[];
}

/** One observed (or declared but unused) value of a configuration parameter. */
export interface ConfigurationValueUsage {
    value: string;
    /** The option's display name for enums; the raw value otherwise. */
    label: string;
    count: number;
    isDefault: boolean;
}

export interface ConfigurationParameterUsage {
    parameterId: string;
    name: string;
    type: string;
    defaultValue: string | null;
    /** Total recorded values for this parameter, the base for percentages. */
    total: number;
    values: ConfigurationValueUsage[];
}

/**
 * One declared enum option and how often it was chosen. Only an enum declares
 * its options, so only an enum can have one nobody picked.
 */
export interface UnusedOptionOut {
    elementId: string;
    partName: string;
    parameterId: string;
    parameterName: string;
    value: string;
    label: string;
    count: number;
    isDefault: boolean;
    /** Recorded values for this parameter, so a count reads as a share. */
    parameterTotal: number;
}

/** How an insert reached Onshape: derived into a part studio, or inserted. */
export interface TargetSplit {
    partStudio: number;
    assembly: number;
}

export interface InsertableReportOut {
    elementId: string;
    name: string | null;
    documentId: string | null;
    versionId: string | null;
    insertCount: number;
    /** Lifetime inserts scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    firstInsertedAt: number | null;
    uniqueUsers: number;
    /** How many users currently have this part favorited. */
    favorites: number;
    /** Inserts by the kind of tab they landed in; derived vs. inserted. */
    targets: TargetSplit;
    parameters: ConfigurationParameterUsage[];
}
