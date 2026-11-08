import { LibraryId } from "../library/library-id";
import type { ElementPath } from "../../lib/onshape/path";
import { UseSource, UseTarget } from "./usage";
import type {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";

/** Every target is listed, so an unused one reads as zero. They sum to the uses. */
export type UseTargets = Record<UseTarget, number>;

export function emptyTargets(): UseTargets {
    return Object.fromEntries(
        Object.values(UseTarget).map((target) => [target, 0])
    ) as UseTargets;
}

/** The uses that went into Onshape: quick insert's denominator. */
export function insertsOf(targets: UseTargets): number {
    return targets[UseTarget.PART_STUDIO] + targets[UseTarget.ASSEMBLY];
}

/** Lifetime counts, either overall or scoped to one library. */
export interface AnalyticsTotals {
    /** Inserts and downloads; `targets` splits them. */
    uses: number;
    /** App-wide only; zero for a library. */
    appOpens: number;
    uniqueUsers: number;
    /** A subset of `uses`. */
    favoriteUses: number;
    /** A subset of the inserts; see {@link insertsOf}. */
    quickInserts: number;
    /** Onshape only offers fasten on assemblies, so compare to that entry of `targets`. */
    fastenInserts: number;
    /** Into an assembly, of a part offering insert and fasten; the base of the next two. */
    fastenableInserts: number;
    /** Fastened to edges or faces picked in Onshape beforehand. */
    preselectedInserts: number;
    /** Placed by Auto Assembly; also its entry of the sources. */
    autoAssemblyInserts: number;
    targets: UseTargets;
    /** Current, not over the range: a favorite is state, not an event. */
    favorites: number;
}

/** One day of the range chart; `counts` is keyed by library id. */
export interface DailyUsePoint {
    day: string;
    counts: Partial<Record<LibraryId, number>>;
}

/** One series backs every trend, so a tile and its chart can't disagree. */
export interface DailyMetricPoint {
    day: string;
    uses: number;
    /** App-wide, as `AnalyticsTotals.appOpens`. */
    appOpens: number;
    /** Distinct users active that day; not summable across days. */
    activeUsers: number;
    favoriteUses: number;
    quickInserts: number;
    fastenInserts: number;
    fastenableInserts: number;
    preselectedInserts: number;
    autoAssemblyInserts: number;
    /** That day's uses by target; the assembly entry is fasten's denominator. */
    targets: UseTargets;
}

/** Lifetime uses started from one part of the app. */
export interface UseSourceUsage {
    source: UseSource;
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

/** Season to date against the same stretch of the season before. */
export interface GrowthOut {
    uses: PeriodComparison;
    activeUsers: PeriodComparison;
    /** Absent for a library: an app open belongs to none. */
    appOpens?: PeriodComparison;
}

export interface LibrarySummaryOut {
    /** Over the requested range, for the headline cards. */
    totals: AnalyticsTotals;
    /** Also over the range, for the chart and the sparklines. */
    metricSeries: DailyMetricPoint[];
    growth: GrowthOut;
    /** Over the range, for the library's own topic. */
    reports: ReportSummary;
    /** The library's parts reported over the range, most reported first. */
    reportedParts: ReportedPartOut[];
    from: string;
    to: string;
}

/** What the version manager has done, and how much is linked to do it with. */
export interface VersionManagerTotals {
    /** Pushes and pulls together. */
    runs: number;
    /** Runs with a step that failed, partway or entirely. */
    runsWithFailures: number;
    /** Tabs whose references the app repointed. */
    updatedElements: number;
    createdVersions: number;
    /** Current, not over the range: a link is state, not an event. */
    links: number;
}

/** Reports of one kind about one topic, over the range. */
export interface ReportCount {
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    count: number;
}

/** A part reported over the range, most reported first. */
export interface ReportedPartOut {
    /** The version-pinned tab, as the parts table links it. */
    path: ElementPath;
    name: string;
    count: number;
}

export interface ReportSummary {
    /** Every report over the range; only the kinds that happened are listed. */
    counts: ReportCount[];
}

/** The overview's headline numbers, and the series its trends are drawn from. */
export interface OverviewUsageOut {
    /** Over the requested range, for the headline cards. */
    totals: AnalyticsTotals;
    /** Also over the range, for the sparklines and the trend tiles. */
    metricSeries: DailyMetricPoint[];
    growth: GrowthOut;
    from: string;
    to: string;
}

/** A row of the parts table. Only parts still in the library are listed. */
export interface PartUsageOut {
    libraryId: LibraryId;
    /** The version-pinned tab, which is both the analytics key and the link. */
    path: ElementPath;
    name: string;
    groupName: string;
    /** Hidden parts stay listed: they are in the library, just not insertable. */
    isVisible: boolean;
    /** Uses inside the reported window; 0 for a part unused in it. */
    useCount: number;
    /** The window's uses scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    /** Users who have it favorited now, whatever the window. */
    favorites: number;
    /** Daily uses over the last {@link MONTH_DAYS}, oldest first. */
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
    useCount: number;
    /** Lifetime uses scaled to a month; see {@link usesPerMonth}. */
    usesPerMonth: number;
    uniqueUsers: number;
    /** How many users currently have this part favorited. */
    favorites: number;
    /** Uses by where the part went: derived, inserted or downloaded. */
    targets: UseTargets;
    parameters: ConfigurationParameterUsage[];
}
