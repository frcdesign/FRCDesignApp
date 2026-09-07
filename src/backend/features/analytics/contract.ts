import { LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import type { ElementPath } from "../../lib/onshape/path";
import { InsertSource } from "./events";

/**
 * Inserts by the kind of tab they landed in. Every type is listed, so a tab
 * nobody inserts into reads as a zero rather than a missing key.
 */
export type InsertTargets = Record<ElementType, number>;

export function emptyTargets(): InsertTargets {
    return Object.fromEntries(
        Object.values(ElementType).map((type) => [type, 0])
    ) as InsertTargets;
}

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
     * its denominator is the assembly entry of `targets`, not `inserts`.
     */
    fastenInserts: number;
    targets: InsertTargets;
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
    /** That day's inserts by target; the assembly entry is fasten's denominator. */
    targets: InsertTargets;
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

/**
 * Why a change cannot be stated: an unmeasured baseline, two empty windows, or
 * an empty baseline, which reads as new rather than infinite.
 */
export enum ChangeUnavailable {
    NO_PRIOR_DATA = "no-prior-data",
    PARTIAL_PRIOR_DATA = "partial-prior-data",
    NO_ACTIVITY = "no-activity",
    ZERO_BASELINE = "zero-baseline"
}

/** One measure over a window and the matching earlier window. */
export interface PeriodComparison {
    current: number;
    previous: number;
    /** Absent whenever stating a change would be dishonest; see `unavailable`. */
    changeRatio?: number;
    /** Why there is no change to state; absent whenever `changeRatio` is set. */
    unavailable?: ChangeUnavailable;
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
    growth: GrowthOut;
}

/** A row of the parts table. Only parts still in the library are listed. */
export interface PartUsageOut {
    /** The version-pinned tab, which is both the analytics key and the link. */
    path: ElementPath;
    name: string;
    groupName: string;
    /** Hidden parts stay listed: they are in the library, just not insertable. */
    isVisible: boolean;
    /** Inserts inside the reported window; 0 for a part unused in it. */
    insertCount: number;
    /** The window's inserts scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    /** Daily inserts over a trailing {@link MONTH_DAYS}, oldest first: a
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
    defaultValue?: string;
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
    option: ConfigurationValueUsage;
    /** Recorded values for this parameter, so a count reads as a share. */
    parameterTotal: number;
}

export interface InsertableReportOut {
    elementId: string;
    /** Absent once the part has left the library, as is the path to open it. */
    name?: string;
    path?: ElementPath;
    insertCount: number;
    /** Lifetime inserts scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    uniqueUsers: number;
    /** How many users currently have this part favorited. */
    favorites: number;
    /** Inserts by the kind of tab they landed in; derived vs. inserted. */
    targets: InsertTargets;
    parameters: ConfigurationParameterUsage[];
}
