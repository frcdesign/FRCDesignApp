import { BuildIssueSeverity, BuildIssueType } from "../build-checker/issues";
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
 * One day of every tracked metric, as raw counts so the client can ratio them.
 *
 * A single series backs every trend on the dashboard — the sparkline on a tile
 * and the chart behind it are the same numbers, so they cannot disagree.
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
 * Build-health counts for a library. The severity counts are of issues, not
 * items: one part with three warnings is three, so fixing it moves the number
 * by what it actually cost. `healthyItems` counts items, and is what
 * `groupCount + insertableCount` partitions.
 */
export interface LibraryHealthCounts {
    groupCount: number;
    insertableCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    healthyItems: number;
    /** Groups and insertables that have never loaded successfully. */
    neverLoaded: number;
}

/** How many items carry one kind of issue. */
export interface HealthIssueCount {
    type: BuildIssueType;
    description: string;
    severity: BuildIssueSeverity;
    count: number;
}

/** A group or insertable with at least one issue. */
export interface HealthItem {
    kind: "group" | "insertable";
    id: string;
    name: string;
    /** The parent group's name, for insertables. */
    groupName: string | null;
    documentId: string;
    versionId: string;
    /** Null for groups, which are documents rather than tabs. */
    elementId: string | null;
    issues: BuildIssueType[];
    severity: BuildIssueSeverity;
    lastLoadedAt: number | null;
}

export interface LibraryHealthOut {
    counts: LibraryHealthCounts;
    issues: HealthIssueCount[];
    items: HealthItem[];
}

export interface LibrarySummary {
    libraryId: LibraryId;
    totals: AnalyticsTotals;
    /** Scoped to the selected range, so the table agrees with the tiles. */
    rangeTotals: AnalyticsTotals;
    health: LibraryHealthCounts;
}

export interface AnalyticsOverviewOut {
    /** Lifetime totals, shown as context beneath each tile's range value. */
    totals: AnalyticsTotals;
    /** The same measures restricted to the selected range — what tiles show. */
    rangeTotals: AnalyticsTotals;
    libraries: LibrarySummary[];
    /** Per-library daily inserts, for the inserts tile's split-out detail. */
    series: DailyInsertPoint[];
    metricSeries: DailyMetricPoint[];
    sources: InsertSourceUsage[];
    from: string;
    to: string;
}

/** The trailing days each parts-table row's sparkline plots. */
export const SPARKLINE_DAYS = 30;

/** The days a "month" stands for in the per-month usage rate. */
const MONTH_DAYS = 30;

/**
 * Inserts per month, normalized for how long a part has been in use so one
 * added recently is not buried under one that has been around for years.
 *
 * The observed span is floored at a month, so a part used twice in its first
 * week reads as 2 rather than being extrapolated to 60. Rounded, because a
 * rate with decimals in it is harder to scan than it is precise.
 */
export function usesPerMonth(
    insertCount: number,
    firstInsertedAt: number | null,
    now: number
): number {
    if (insertCount === 0 || firstInsertedAt === null) return 0;
    const days = (now - firstInsertedAt) / (24 * 3600 * 1000);
    return Math.round((insertCount * MONTH_DAYS) / Math.max(days, MONTH_DAYS));
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
    insertCount: number;
    /** Lifetime inserts scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    lastInsertedAt: number | null;
    /** Daily inserts over the trailing window, oldest first, for the sparkline. */
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
    /** True when the parameter no longer exists on the insertable. */
    isRetired: boolean;
}

/**
 * One declared enum option and how often it was actually chosen, across a
 * whole library. Only enums appear: a quantity or string parameter has no
 * declared option list, so "never used" is not a question that can be asked.
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
    lastInsertedAt: number | null;
    uniqueUsers: number;
    /** How many users currently have this part favorited. */
    favorites: number;
    /** Inserts by the kind of tab they landed in; derived vs. inserted. */
    targets: TargetSplit;
    series: { day: string; count: number }[];
    parameters: ConfigurationParameterUsage[];
}
