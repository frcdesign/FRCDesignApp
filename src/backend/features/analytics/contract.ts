import { LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import type { ElementPath } from "../../lib/onshape/path";
import { InsertSource } from "./usage";

/** Every type is listed, so an unused one reads as zero. */
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
    /** Onshape only offers fasten on assemblies, so compare to that entry of `targets`. */
    fastenInserts: number;
    targets: InsertTargets;
    /** Current, not over the range: a favorite is state, not an event. */
    favorites: number;
}

/** One day of the range chart; `counts` is keyed by library id. */
export interface DailyInsertPoint {
    day: string;
    counts: Partial<Record<LibraryId, number>>;
}

/** One series backs every trend, so a tile and its chart can't disagree. */
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

/** Severity counts are of issues; `healthyItems` counts items. */
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

/** An empty baseline reads as new rather than infinite. */
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
    /** Daily inserts over the last {@link MONTH_DAYS}, oldest first. */
    recent: number[];
}

/** One observed (or declared but unused) value of a configuration parameter. */
export interface ConfigurationValueUsage {
    value: string;
    /** The option's display name for enums; the raw value otherwise. */
    label: string;
    count: number;
    isDefault: boolean;
    /** The declared default isn't offered here; see `resolveSelectedOption`. */
    isImplicitDefault?: boolean;
}

/** One parameter under one set of controlling choices; see `instances.ts`. */
export interface ConfigurationParameterUsage {
    parameterId: string;
    name: string;
    type: string;
    defaultValue?: string;
    /** Outermost first, e.g. ["Generic"]; empty when unconditioned. */
    path: string[];
    /** Recorded values counted here, the base for percentages. */
    total: number;
    values: ConfigurationValueUsage[];
}

/** Only an enum declares its options, so only an enum can have an unused one. */
export interface UnusedOptionOut {
    path: ElementPath;
    partName: string;
    parameterId: string;
    parameterName: string;
    /** See {@link ConfigurationParameterUsage.path}. */
    parameterPath: string[];
    value: ConfigurationValueUsage;
    /** Every recorded value for this parameter. */
    parameterTotal: number;
}

export interface InsertableReportOut {
    /** Only a part still in the library is reported on, so both are known. */
    name: string;
    path: ElementPath;
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
