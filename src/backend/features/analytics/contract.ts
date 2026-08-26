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
 * Build-health counts for a library. Items are counted by their *worst*
 * severity, so the four buckets partition every group and insertable.
 */
export interface LibraryHealthCounts {
    groupCount: number;
    insertableCount: number;
    errorItems: number;
    warningItems: number;
    infoItems: number;
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

/** A row of the parts table; nulls mean the part left the library. */
export interface PartUsageOut {
    elementId: string;
    insertableId: string | null;
    name: string | null;
    groupName: string | null;
    documentId: string | null;
    versionId: string | null;
    insertCount: number;
    lastInsertedAt: number | null;
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

export interface InsertableReportOut {
    elementId: string;
    name: string | null;
    documentId: string | null;
    versionId: string | null;
    insertCount: number;
    firstInsertedAt: number | null;
    lastInsertedAt: number | null;
    uniqueUsers: number;
    series: { day: string; count: number }[];
    parameters: ConfigurationParameterUsage[];
}
