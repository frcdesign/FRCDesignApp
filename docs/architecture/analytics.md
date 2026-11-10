# Analytics and the dashboard

## Purpose

Records how the libraries are used — each **use** of a part, an insert into
Onshape or a STEP download, and each launch from Onshape —
and how often people report problems, and what design checks find in people's
own CAD, and shows it on a public dashboard: totals and trends, per-library health,
which parts and configuration options are used, and which aren't. It exists so
the library team can see what to maintain and what to cut, and what to teach.

It records nothing a user sees back about themselves, and reports only
aggregates.

## Code map

In the order an event travels: recorded, logged, rolled up, read, drawn.

`src/backend/features/analytics/usage.ts`, a leaf module the frontend also
imports

```ts
/** Bump when the columns' meaning changes. */
const EVENT_SCHEMA_VERSION = 2;

enum EventType {
    INSERT = "insert",
    /** A part exported to a STEP file; see `features/download`. */
    DOWNLOAD = "download",
    APP_OPEN = "app_open",
    /** One finished push or pull; see `features/version-manager`. */
    VERSION_RUN = "version_run",
    /** One report posted to Discord; see `features/feedback`. */
    REPORT = "report",
    /** One check of a Part Studio or Assembly; see `features/design-check`. */
    DESIGN_CHECK = "design_check"
}

/** A use is an insert or a download: each counts toward a part's usage. */
const USE_EVENT_TYPES = [EventType.INSERT, EventType.DOWNLOAD] as const;

/**
 * Where a used part went. An insert's is the kind of tab it landed in, which
 * share `ElementType`'s values, so its rows read either way.
 */
enum UseTarget {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY",
    DOWNLOAD = "DOWNLOAD"
}

/** Where the use started, not whether the part is favorited. */
enum UseSource {
    /** Searching the whole library, from its home list. */
    SEARCH = "search",
    /** Searching inside one group, which filters the results to it. */
    GROUP_SEARCH = "group_search",
    /** The group's own list of parts. */
    BROWSE = "browse",
    FAVORITES = "favorites",
    RECENTS = "recents"
}
```

`src/backend/features/analytics/tracking.ts`, called by the routes and the
workflow that did the work

```ts
// In the background, after the response; see Recording.
function trackInsert(c: AppContext, event: InsertEvent): Promise<void>;
function trackDownload(c: AppContext, event: UseEvent): Promise<void>;
function trackAppOpen(c: AppContext): Promise<void>;
function trackReport(c: AppContext, event: ReportEvent): Promise<void>;
function trackDesignCheck(
    c: AppContext,
    event: DesignCheckEvent
): Promise<void>;
// Awaited inside the workflow's `record-run` step, which swallows its failure.
async function trackVersionRun(
    env: AppBindings,
    event: VersionRunEvent
): Promise<void>;
// The event and its rollup rows in one D1 batch.
async function record(
    db: Db,
    event: LoggedEvent,
    parameters: ConfigurationParameter[]
): Promise<void>;

/** What every use records, an insert or a download. The caller is the user. */
interface UseEvent {
    libraryId: LibraryId;
    /** The rollups key on the element id; the rest records the version. */
    path: ElementPath;
    insertableId: string;
    /** The whole selection the use applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the route already loaded them. */
    parameters: ConfigurationParameter[];
    /** Whether the part was favorited, not where the use came from. */
    isFavorite: boolean;
    source: UseSource;
}

interface InsertEvent extends UseEvent {
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    isQuickInsert: boolean;
    fasten: boolean;
}

/** A finished push or pull; see `features/version-manager`. */
interface VersionRunEvent {
    userId: string;
    kind: VersionJobKind;
    scope: PushScopeKind | PullScopeKind;
    /** How it ended. */
    status: VersionJobStatus;
}

/** Who sent a report, when they weren't signed in. */
const SIGNED_OUT_USER_ID = "signed-out";

/** A report already posted to Discord; see `features/feedback`. */
interface ReportEvent {
    /** The id the Discord post quotes, so the two can be matched. */
    id: string;
    /** Undefined for a reporter who isn't signed in. */
    userId: string | undefined;
    /** The topic's library, when it has one. */
    libraryId: LibraryId | undefined;
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    /** The reporter's FRC or FTC team, when they gave it. */
    teamNumber?: number;
    /** Set for a report from a part's menu. */
    part?: { path: ElementPath; insertableId: string };
}

/** A finished check of the caller's own tab; see `features/design-check`. */
interface DesignCheckEvent {
    elementType: ElementType;
    issues: DesignIssue[];
}
```

`src/backend/features/analytics/schema.ts`: the `events` table, whose row is
`LoggedEvent` (`typeof events.$inferSelect`), spelled out here with the
columns' comments. Every rollup table is listed under **Storage**.

```ts
/** One row of the log: everything the rollups are derived from. */
type LoggedEvent = {
    id: string;
    type: EventType;
    createdAt: Date;
    /** YYYY-MM-DD in the reporting time zone (`toDayKey`), so rollups rebuild with a GROUP BY. */
    day: string;
    /** Null for an event that belongs to no library, such as a version run. */
    libraryId: LibraryId | null;
    userId: string;
    /** Rows predating the column were version 1. */
    schemaVersion: number;
    /** The versioned path, since the library row moves on after a reload. */
    elementId: string | null;
    documentId: string | null;
    instanceId: string | null;
    instanceType: InstanceType | null;
    /** The app id at event time; kept for debugging, never joined on. */
    insertableId: string | null;
    /** The type of tab the user inserted into, not the insertable's own type; null for a download. */
    targetElementType: ElementType | null;
    /** What the insert or download applied, minus the parameters it hid. */
    selection: Selection | null;
    /** Favorited at the time of the use; `source` says where the use started. */
    isFavorite: boolean | null;
    isQuickInsert: boolean | null;
    source: UseSource | null;
    /** Insert-and-fasten, which Onshape only offers for assembly targets. */
    fasten: boolean | null;
    /** A version run's own columns: how it was aimed, and what it did. */
    versionKind: VersionJobKind | null;
    versionScope: PushScopeKind | PullScopeKind | null;
    versionUpdateOnly: boolean | null;
    versionOutcome: VersionJobOutcome | null;
    failedSteps: number | null;
    createdVersions: number | null;
    updatedElements: number | null;
    /** A report's own columns; a part report also sets the element's. */
    reportTopic: FeedbackTopic | null;
    reportCategory: FeedbackCategory | null;
    reportSource: FeedbackSource | null;
    reportTeamNumber: number | null;
    /** A design check's own columns: the kind of tab it read, and what it found there. */
    checkedElementType: ElementType | null;
    designIssueCounts: DesignIssueCounts | null;
};
```

`src/backend/features/analytics/logged-event.ts`, the one place that knows
which columns each kind of event sets

```ts
// Each narrows a row to its kind; undefined for any other.
function asUse(event: LoggedEvent): LoggedUse | undefined;
function asVersionRun(event: LoggedEvent): LoggedVersionRun | undefined;
function asReport(event: LoggedEvent): LoggedReport | undefined;
function asDesignCheck(event: LoggedEvent): LoggedDesignCheck | undefined;

/** What every event carries, whatever kind of event it is. */
type EventCore = Pick<
    LoggedEvent,
    | "id"
    | "type"
    | "createdAt"
    | "day"
    | "libraryId"
    | "userId"
    | "schemaVersion"
>;

/** The part a use or a part report named. */
type ElementColumns = Pick<
    LoggedEvent,
    "elementId" | "documentId" | "instanceId" | "instanceType" | "insertableId"
>;

/** What only a use, an insert or a download, fills in. */
type UseColumns = Omit<
    LoggedEvent,
    | keyof EventCore
    | keyof VersionRunColumns
    | keyof ReportColumns
    | keyof DesignCheckColumns
    | keyof ElementColumns
>;

/** What only a version run fills in. */
type VersionRunColumns = Pick<
    LoggedEvent,
    | "versionKind"
    | "versionScope"
    | "versionUpdateOnly"
    | "versionOutcome"
    | "failedSteps"
    | "createdVersions"
    | "updatedElements"
>;

/** What only a report fills in. */
type ReportColumns = Pick<
    LoggedEvent,
    "reportTopic" | "reportCategory" | "reportSource" | "reportTeamNumber"
>;

/** What only a design check fills in. */
type DesignCheckColumns = Pick<
    LoggedEvent,
    "checkedElementType" | "designIssueCounts"
>;

// Every column of its group set to null, spelled out so a new column fails to
// compile until each kind of event says what it holds.
const NOT_A_USE: UseColumns;
const NO_ELEMENT: ElementColumns;
const NOT_A_VERSION_RUN: VersionRunColumns;
const NOT_A_REPORT: ReportColumns;
const NOT_A_DESIGN_CHECK: DesignCheckColumns;

/** A logged insert or download, whose own columns a reader can then count on. */
type LoggedUse = LoggedEvent & {
    /** A use is always from a library, whatever the column allows. */
    libraryId: LibraryId;
    elementId: string;
    source: UseSource;
    /** Where the part went, which the rollups split by. */
    target: UseTarget;
};

/** A logged run, whose own columns a reader can then count on. */
type LoggedVersionRun = LoggedEvent & {
    versionKind: VersionJobKind;
    versionUpdateOnly: boolean;
    versionOutcome: VersionJobOutcome;
    failedSteps: number;
    createdVersions: number;
    updatedElements: number;
};

/** A logged report, whose own columns a reader can then count on. */
type LoggedReport = LoggedEvent & {
    reportTopic: FeedbackTopic;
    reportCategory: FeedbackCategory;
    reportSource: FeedbackSource;
};

/** A logged design check, whose own columns a reader can then count on. */
type LoggedDesignCheck = LoggedEvent & {
    checkedElementType: ElementType;
    designIssueCounts: DesignIssueCounts;
};
```

`src/backend/features/analytics/rollups.ts`

```ts
// The rollup rows one event adds to, from the row and the part's parameters
// alone, so a replay of the log rebuilds them exactly.
function rollupWrites(
    db: Db,
    event: LoggedEvent,
    parameters: ConfigurationParameter[]
): BatchItem<"sqlite">[];
```

`src/backend/features/analytics/routes.ts`, public and read-only. Every route
but health takes `from` and `to` day keys (`rangeQuery`); the overview and a
library's summary clamp them to when tracking began (`clampRange`,
`getTrackingSince`).

```text
GET /api/analytics/overview/usage                                   OverviewUsageOut
GET /api/analytics/overview/series                                  DailyUsePoint[], per library
GET /api/analytics/overview/sources                                 UseSourceUsage[]
GET /api/analytics/overview/version-manager                         VersionManagerTotals
GET /api/analytics/overview/design-check                            DesignCheckTotals
GET /api/analytics/overview/reports                                 ReportSummary
GET /api/analytics/summary/library/:libraryId                       LibrarySummaryOut
GET /api/analytics/health/library/:libraryId?v=                     LibraryHealthCounts, cached by the library's version
GET /api/analytics/parts/library/:libraryId                         PartUsageOut[]
GET /api/analytics/unused/library/:libraryId?threshold=             PartUsageOut[], at or below the threshold
GET /api/analytics/unused-options/library/:libraryId?threshold=     UnusedOptionOut[]
GET /api/analytics/insertable/library/:libraryId/element/:elementId InsertableReportOut
```

`src/backend/features/analytics/metric-queries.ts`, `growth.ts`,
`part-queries.ts` and `report-queries.ts`, the reads behind them

```ts
async function getTotals(
    db: Db,
    libraryId?: LibraryId,
    range?: DayRange
): Promise<AnalyticsTotals>;
async function getMetricSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyMetricPoint[]>;
// Per library, for the overview's chart.
async function getSeries(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<DailyUsePoint[]>;
async function getSources(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<UseSourceUsage[]>;
async function getVersionManagerTotals(
    db: Db,
    range: DayRange
): Promise<VersionManagerTotals>;
async function getDesignCheckTotals(
    db: Db,
    range: DayRange
): Promise<DesignCheckTotals>;
// Who was about each day: library activity unioned with app opens.
function activeUserRows(db: Db, range: DayRange, libraryId?: LibraryId);
// How many of them over the whole range: a union of ids, which dedupes them.
async function countActiveUsers(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<number>;
// Season to date against the same stretch of the season before.
async function getGrowth(
    db: Db,
    through: string,
    trackingSince: string | undefined,
    libraryId?: LibraryId
): Promise<GrowthOut>;
// From `insertables`, so unused parts list at zero and removed ones don't list.
function getPartRows(
    db: Db,
    libraryId: LibraryId,
    options: { visibleOnly?: boolean } = {}
): Promise<PartRow[]>;
async function getWindowedUseCounts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange
): Promise<Map<string, number>>;
async function getConfigurationCounts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange,
    elementId?: string
): Promise<ConfigurationCount[]>;
// `parameter-usage.ts`: option usage, per way a parameter is shown.
function buildParameterUsage(
    parameters: ConfigurationParameter[],
    valueRows: ValueCount[]
): ConfigurationParameterUsage[];
async function getReportSummary(
    db: Db,
    range: DayRange,
    topic?: FeedbackTopic
): Promise<ReportSummary>;
async function getReportedParts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange
): Promise<ReportedPartOut[]>;
// `health.ts`: build-issue counts, hidden elements left out.
async function getHealthCounts(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryHealthCounts>;

interface PartRow {
    libraryId: LibraryId;
    elementId: string;
    name: string;
    groupName: string;
    documentId: string;
    versionId: string;
    isVisible: boolean;
    firstUsedAt: Date | null;
    favorites: number;
}

interface ConfigurationCount {
    elementId: string;
    parameterId: string;
    value: string;
    /** The branch it was chosen in; see `toInstanceKeys`. */
    instanceKey: string;
    count: number;
}

/** One value as it was recorded: what was chosen, and in which branch. */
interface ValueCount {
    parameterId: string;
    value: string;
    /** See `toInstanceKeys`; empty for a parameter nothing conditions. */
    instanceKey: string;
    count: number;
}
```

`src/backend/features/analytics/day.ts` and `seasons.ts`, leaf modules the
frontend also imports

```ts
// The day an instant fell on, in America/New_York.
function toDayKey(timestamp: number): string;
// Yesterday: today is still filling, and would dip every chart.
function toReportingDay(timestamp: number): string;

/** Both bounds inclusive, as every day key comparison here is. */
interface DayRange {
    from: string;
    to: string;
}

/** Usage is compared by season: a Jan–Apr competition's year is nothing like a calendar one. */
enum Program {
    FRC = "FRC",
    FTC = "FTC"
}

/** Which competition each library serves. */
const LIBRARY_PROGRAM: Record<LibraryId, Program>;
```

`src/backend/features/analytics/contract.ts`, a leaf module the frontend also
imports: everything the routes return

```ts
/** Every target is listed, so an unused one reads as zero. They sum to the uses. */
type UseTargets = Record<UseTarget, number>;

function emptyTargets(): UseTargets;

/** The uses that went into Onshape: quick insert's denominator. */
function insertsOf(targets: UseTargets): number;

/** Lifetime counts, either overall or scoped to one library. */
interface AnalyticsTotals {
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
    targets: UseTargets;
    /** Current, not over the range: a favorite is state, not an event. */
    favorites: number;
}

/** One day of the range chart; `counts` is keyed by library id. */
interface DailyUsePoint {
    day: string;
    counts: Partial<Record<LibraryId, number>>;
}

/** One series backs every trend, so a tile and its chart can't disagree. */
interface DailyMetricPoint {
    day: string;
    uses: number;
    /** App-wide, as `AnalyticsTotals.appOpens`. */
    appOpens: number;
    /** Distinct users active that day; not summable across days. */
    activeUsers: number;
    favoriteUses: number;
    quickInserts: number;
    fastenInserts: number;
    /** That day's uses by target; the assembly entry is fasten's denominator. */
    targets: UseTargets;
}

/** Lifetime uses started from one part of the app. */
interface UseSourceUsage {
    source: UseSource;
    count: number;
    /** How many of those used the context-menu quick insert. */
    quickInsertCount: number;
}

/** Severity counts are of issues; `healthyItems` counts items. */
interface LibraryHealthCounts {
    groupCount: number;
    insertableCount: number;
    errorCount: number;
    warningCount: number;
    healthyItems: number;
}

/** An empty baseline reads as new rather than infinite. */
enum ChangeUnavailable {
    NO_PRIOR_DATA = "no-prior-data",
    PARTIAL_PRIOR_DATA = "partial-prior-data",
    NO_ACTIVITY = "no-activity",
    ZERO_BASELINE = "zero-baseline"
}

/** One measure over a window and the matching earlier window. */
interface PeriodComparison {
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
interface GrowthOut {
    uses: PeriodComparison;
    activeUsers: PeriodComparison;
    /** Absent for a library: an app open belongs to none. */
    appOpens?: PeriodComparison;
}

interface LibrarySummaryOut {
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
interface VersionManagerTotals {
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

/** What design checks have found, over the range. */
interface DesignCheckTotals {
    /** Part studios and assemblies together. */
    checks: number;
    /** Checks that found nothing FRCDesign's levels show. */
    cleanChecks: number;
    partStudioChecks: number;
    assemblyChecks: number;
    /** Each type found at least once, in the most checks first. */
    issueTypes: DesignIssueTypeCount[];
}

/** One type of design issue, over the range. */
interface DesignIssueTypeCount {
    type: DesignIssueType;
    /** Checks that found it. */
    checks: number;
    /** How many were found, across those checks. */
    issues: number;
}

/** Reports of one kind about one topic, over the range. */
interface ReportCount {
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    count: number;
}

/** A part reported over the range, most reported first. */
interface ReportedPartOut {
    /** The version-pinned tab, as the parts table links it. */
    path: ElementPath;
    name: string;
    count: number;
}

interface ReportSummary {
    /** Every report over the range; only the kinds that happened are listed. */
    counts: ReportCount[];
}

/** The overview's headline numbers, and the series its trends are drawn from. */
interface OverviewUsageOut {
    /** Over the requested range, for the headline cards. */
    totals: AnalyticsTotals;
    /** Also over the range, for the sparklines and the trend tiles. */
    metricSeries: DailyMetricPoint[];
    growth: GrowthOut;
    from: string;
    to: string;
}

/** A row of the parts table. Only parts still in the library are listed. */
interface PartUsageOut {
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
interface ConfigurationValueUsage {
    value: string;
    /** The option's display name for enums; the raw value otherwise. */
    label: string;
    count: number;
    isDefault: boolean;
    /** The declared default isn't offered here; see `resolveSelectedOption`. */
    isImplicitDefault?: boolean;
}

/** One parameter under one set of controlling choices; see `instances.ts`. */
interface ConfigurationParameterUsage {
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
interface UnusedOptionOut {
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

interface InsertableReportOut {
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
```

`src/backend/features/download/routes.ts`, `src/backend/features/entry/routes.ts`
and `src/backend/features/design-check/routes.ts`, three of the routes that
record

```text
POST /api/step-export/insertable/:insertableId    trackDownload, once Onshape accepts the export
POST /api/app-open                                trackAppOpen, sent by /init's handoff
GET  /api/design-check                            trackDesignCheck, once the checks have run
```

`src/frontend/features/dashboard/dashboard-queries.ts`, one query per route,
keyed by the range; and `src/frontend/routes/dashboard/`, the pages: overview,
library, part, unused

```ts
// One per overview area; each loads, and fails, on its own.
function getOverviewUsageQuery(range: DayRange);
function getOverviewSeriesQuery(range: DayRange);
function getOverviewSourcesQuery(range: DayRange);
function getVersionManagerQuery(range: DayRange);
function getDesignCheckQuery(range: DayRange);
function getOverviewReportsQuery(range: DayRange);
function getLibrarySummaryQuery(libraryId: LibraryId, range: DayRange);
function getPartsQuery(libraryId: LibraryId, range: DayRange);
function getUnusedQuery(
    libraryId: LibraryId,
    threshold: number,
    range: DayRange
);
function getUnusedOptionsQuery(
    libraryId: LibraryId,
    threshold: number,
    range: DayRange
);
function getInsertableReportQuery(
    libraryId: LibraryId,
    elementId: string,
    range: DayRange
);
function getHealthQuery(libraryId: LibraryId, cacheVersion: number);
// The first failure among several queries, else the first still loading.
function firstPending(
    queries: UseQueryResult<unknown>[]
): UseQueryResult<unknown> | undefined;
```

`src/frontend/features/dashboard/dashboard-state.tsx`

```ts
// What stands in for a section while its query has no data: `SectionLoading`,
// or `SectionError` with **Try again** and **Send a report**.
function DashboardState(props: DashboardStateProps): ReactNode;
// A `SectionNotice` for a section that loaded with nothing to draw.
function DashboardEmpty(props: DashboardEmptyProps): ReactNode;

interface DashboardStateProps {
    query: UseQueryResult<unknown>;
    /** Takes the form "Loading {thing}...". */
    loading: string;
    /** The section's title, for a section whose content draws its own. */
    title?: string;
}

interface DashboardEmptyProps {
    title: string;
    /** @default a dimmed chart */
    icon?: Icon;
    /** @default StatusColor.DIMMED */
    color?: StatusColor;
}
```

`src/frontend/features/dashboard/metrics.ts`, what each trend tile and chart
measures

```ts
const METRICS: Record<MetricKey, MetricDefinition>;
// Shares are computed after bucketing, or quiet days would be over-weighted.
function toTrend(
    points: DailyMetricPoint[],
    metric: MetricDefinition,
    granularity: Granularity = pickGranularity(points.map((p) => p.day))
): TrendPoint[];
function rangeValue(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): number;

type MetricKey =
    | "uses"
    | "fastenFraction"
    | "quickFraction"
    | "assemblyFraction"
    | "downloadFraction";

interface MetricDefinition {
    key: MetricKey;
    label: string;
    /** Percentages divide by `denominator`; counts leave it undefined. */
    numerator: (point: DailyMetricPoint) => number;
    denominator?: (point: DailyMetricPoint) => number;
    /** The all-time figure, shown as context beneath the range value. */
    lifetimeValue: (totals: AnalyticsTotals) => number;
    lifetimeDenominator?: (totals: AnalyticsTotals) => number;
    /** What the detail chart's y-axis is measuring. */
    detailLabel: string;
}
```

| Metric             | Counts                | Divided by            |
| ------------------ | --------------------- | --------------------- |
| `uses`             | Inserts and downloads | —                     |
| `quickFraction`    | Quick inserts         | Inserts (`insertsOf`) |
| `fastenFraction`   | Inserts that fastened | Uses into an assembly |
| `assemblyFraction` | Uses into an assembly | Every use             |
| `downloadFraction` | Downloads             | Every use             |

Named, not copied: `AppContext` and `AppBindings` (`src/backend/lib/context.ts`),
`Db` (`src/backend/db/client.ts`), `ElementPath` and `InstanceType`
(`src/backend/lib/onshape/path.ts`), `ElementType`, `LibraryId`, `Selection`
and `ConfigurationParameter` ([configurations.md](./configurations.md)), the
version manager's `VersionJobKind`, `VersionJobOutcome`, `VersionJobStatus`,
`PushScopeKind` and `PullScopeKind` ([version-manager.md](./version-manager.md)),
feedback's `FeedbackTopic`, `FeedbackCategory` and `FeedbackSource`
([feedback.md](./feedback.md)), and the design check's `DesignIssue`,
`DesignIssueType` and `DesignIssueCounts` ([design-check.md](./design-check.md)).

## Storage

**D1**, in `features/analytics/schema.ts` (kept apart from `db/schema.ts`, since
no foreign key crosses between them):

- `events` — the append-only log. Every event has an id, type, time, day key,
  user and schema version, and the library where it has one; a use adds the
  element path, insertable, canonical selection, source and favorite flag, and
  an insert also its target tab type and the quick-insert and fasten flags,
  which a download leaves null; a version run adds its kind,
  scope, whether it was update-only, its outcome, and how many steps failed,
  versions it created and tabs it updated. A report adds its topic, category,
  source and the team number the reporter gave, and a part report the element
  path and insertable. A design check adds the kind of tab it read and how
  many of each issue type it found, and no element path: the tab is somebody's
  own. Keyed on
  Onshape's element id with no foreign keys, so history survives a reload or a
  re-added tab.
- `library_id` is null for an event that belongs to no library: an app open,
  which is the app being opened rather than the page it resumes into, a
  version run, which acts on the Onshape document the app was launched from,
  a design check, which reads that document too, and a report about the app
  itself. A report from somebody signed out has
  `user_id` `signed-out` (`SIGNED_OUT_USER_ID`).
- Rollups, each derived from the log alone: `daily_metrics`,
  `daily_target_metrics`, `daily_source_metrics`, `insertable_stats`,
  `daily_insertable_metrics`, `daily_insertable_users`,
  `daily_configuration_metrics`, `daily_user_activity`, `user_stats`,
  `daily_app_opens`, `daily_version_metrics`, `daily_report_metrics`,
  `daily_design_check_metrics`, `daily_design_issue_metrics`.
- A use writes every library rollup, an insert and a download alike.
  `daily_metrics` keeps a row per event type, so the uses are the sum of the
  `insert` and `download` rows and either can be read alone.
  `daily_target_metrics` and `daily_insertable_metrics` split by `UseTarget`:
  an insert's target tab type (`PARTSTUDIO`, `ASSEMBLY`, the same strings as
  `ElementType`), or `DOWNLOAD`. The targets sum to the uses.
- `insertable_stats` and `user_stats` count every use in `insert_count`, and
  `insertable_stats` dates them in `first_inserted_at` and `last_inserted_at`;
  the code reads them as `useCount`, `firstUsedAt` and `lastUsedAt`.
- `daily_version_metrics` is keyed by day: runs, update-only runs, runs that
  partially failed and runs that failed outright, versions created and tabs
  updated.
- `daily_design_check_metrics` is keyed by day and the kind of tab checked:
  checks, and checks that found nothing FRCDesign's levels show
  (`isCleanAtDefaults`), so a part with no part number, off by default, leaves a
  check clean. `daily_design_issue_metrics` is keyed by day and issue type: the
  checks that found at least one, and how many they found. The dashboard's
  **Most found** leaves out the types off by default.
- `daily_report_metrics` is keyed by day, topic, category, source and element
  (empty for a report that names no part): the count of reports. By topic
  rather than library, since the app's topics belong to none.
- `daily_app_opens` is keyed by day and user: the count is the app's sessions,
  and the user id is what makes somebody who only ever opened it a user. Every
  app-level count of people is that table unioned with `daily_user_activity`
  (`activeUserRows`), since a library rollup has no row for them. It is also
  indexed on day and opens (`daily_app_opens_day_opens_idx`), so a range's
  opens sum from the index alone.
- `favorites`, in `db/schema.ts`, is read for each part's standing favorites,
  through its index on `insertable_id` (`favorites_insertable_idx`).

## Flows

### Recording

1. An insert route calls `trackInsert` once the insert succeeded;
   `POST /api/step-export` calls `trackDownload` once Onshape accepts the
   export (see [download.md](./download.md)); `/init`'s
   handoff calls `POST /api/app-open`, which calls `trackAppOpen`; the
   version manager's workflow calls `trackVersionRun` in its `record-run` step
   once its run has finished, so a run that failed halfway still records what
   it managed; `POST /api/update-references` records one in the background once
   it has updated a library document's references; `POST /api/feedback` calls `trackReport` once the report is
   posted to Discord (see [feedback.md](./feedback.md)); `GET /api/design-check`
   calls `trackDesignCheck` once its checks have run (see
   [design-check.md](./design-check.md)).
2. A use, an open, a report and a design check are recorded in the background (`runInBackground`),
   after the response; a version run's step swallows a failure to record. So
   tracking never slows or fails what the user asked for.
3. The selection is stored canonically (`canonicalValues`), so `5 in` and
   `(2 + 3) in` count as one value.
4. `record` writes the event and its rollup rows in one D1 batch, so neither
   lands without the other.

### Days and seasons

A day key is the date in `America/New_York`, since US teams work evenings that
UTC midnight would split. Reports end yesterday: today is still filling, and
would dip every chart. Growth compares a season's stretch with the same stretch
of the previous season (`seasons.ts`), since a January–April competition year
is nothing like a calendar year; between seasons it shows the last complete one.

### Reporting

The dashboard is a sibling of `/app`, a full-screen page outside the Onshape
panel. Its routes read only rollups and return only aggregates:

- **Overview** — one route per area, each fetched by its own query, so every
  section shows as soon as its numbers arrive: **usage** (totals, the metric
  series behind the headline tiles and the trend tiles, growth), **series**
  (uses per library per day), **sources**, the **version manager**'s totals,
  the **design check**'s checks and the issue types it finds most, and
  **reports** by topic and type. Its usage breakdown reads each library's
  **Parts** report.
- **Library** — its summary, health (build issues by severity, hidden elements
  left out), its parts table, its reports by type, and its most reported parts.
- **Part** — one element's history, its uses split by target (into an
  assembly, downloaded), and usage of each configuration option, split per way
  the option is shown (`toParameterInstances`).
- **Unused** — parts and options at or below a usage threshold.

The range, threshold and preset live in the url, so a view can be shared.

Every loading, empty and failed section is a notice (`app-notice.tsx`), as
the rest of the app's are. A section whose query is still loading says what it
is loading under its title ("Loading usage..."); one that loaded with nothing
to show says so beside an icon (`DashboardEmpty`); one that failed, after the query client's two retries, shows "Failed to load
analytics." with **Try again**, which refetches only that query, and **Send a
report** (`DashboardState`). The rest of the page is unaffected.

The admin card in the app reads the library's **Parts** report, all time and
fetched once for every card, for a part's uses, monthly rate and favorites,
and links to its **Part** report. It asks only while the card's Usage section is
open, and reuses an answer for five minutes.

Every page's totals are over the picked range, and two numbers are not: the
favorites and linked documents standing now, which are state rather than events
and say so on the tile. The season comparison beside a headline number is shown
only on **All time**, its own window being a season rather than the picked one.

## Invariants

- Tracking never fails or delays the request it records.
- Analytics routes are public: they never call `getUserId()` or
  `getOnshapeApi()`, and never return anything about one user.
- Every rollup is derivable from `events` alone, so the rollups can be rebuilt by
  replaying the log.
- An event without a library writes its own rollups and no other:
  `daily_app_opens` for an open, `daily_version_metrics` for a version run,
  and for a design check `daily_design_check_metrics` and a
  `daily_design_issue_metrics` row per type it found. A report writes
  `daily_report_metrics` alone, with a library or without. Every other rollup
  is keyed by library.
- An event's columns are decided in `logged-event.ts`; a new column fails to
  compile until each kind of event says what it holds.
- Values are compared and counted canonically, never by configuration key.
- Changing what a column means bumps `EVENT_SCHEMA_VERSION`.
- A use is one of `USE_EVENT_TYPES`, and writes every rollup any use writes;
  only its `UseTarget` and the insert-only flags tell the kinds apart. A count
  labelled "uses" sums them all; "inserts" means the uses that went into
  Onshape (`insertsOf`), which quick insert is measured against.
- A use is one part, inserted or downloaded. An action that places several
  parts — an insert and fasten to several picked edges, an Auto Assembly run —
  records one use per part, and every count of uses sums them, the headline
  numbers included.
- A share of a choice only a person makes, such as quick insert, divides by
  the uses that choice was open to, not by every use.
- Every new or major feature records its use here, in the same change
  (`AGENTS.md`, Feature tracking).

## Failure and recovery

| Failure                                       | Result                                                       | Recovery                                                            |
| --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| The tracking write fails                      | That event is lost; what it records is unaffected            | None needed                                                         |
| A rollup is wrong after a code change         | Dashboard numbers off                                        | Replay `events` through `rollupWrites`; no script does this         |
| A range starts before tracking began          | Clamped; growth withheld when its baseline predates tracking | Automatic                                                           |
| D1 refuses a query, overloaded by queued ones | That section's zero state; the others still show             | Retried twice, then **Try again**; **Send a report** if it persists |

## Decisions

- **An app open has no library either.** The only library a launch could name
  is whichever tab the browser last remembered, and the app resumes into a page
  that need not be a library at all, so the number would say more about
  somebody's last tab than about the open. It counts app-wide, in
  `daily_app_opens`, and a library's users are the people who used a part from
  it.
- **A version run has no library.** It acts on whatever document Onshape
  launched the app from. Attributing it to the library the person happened to
  have open would say more about their last tab than about anything real, so
  `library_id` is null and the run rolls up into a table of its own.
- **Reports are not activity.** Reporting a library's part is not using it, so
  a report writes no row to `daily_metrics`, `daily_user_activity` or
  `user_stats`, even when it names a library.
- **Version runs are not activity.** They write no row to `daily_user_activity`
  or `user_stats`: "active user" means somebody who used a part,
  and counting runs there would move the line under every historical
  figure. An open is activity, which is why it is unioned in.
- **A design check has no library, records no document, and is not
  activity.** It reads whatever Part Studio or Assembly Onshape launched the
  app in, which is somebody's own work: the row keeps the kind of tab and
  what was found, never which document, and rolls up into tables of its own.
  As with a version run, counting it in `daily_user_activity` would move the
  line under every historical figure.
- **A download is a use.** Somebody who downloads a part is using the library
  as much as somebody who inserts it, so a download feeds the same totals,
  users, part counts and configuration counts, and the dashboard says "uses"
  for them together. A separate set of download rollups would leave every part
  and option looking less used than it is. `UseTarget` keeps downloads apart
  where the split matters, without a column per kind.
- **Uses count parts, not actions.** The headline numbers say how much of the
  library ends up in people's work, so a run that places 120 screws adds 120,
  and grows them as automation places more. A part's counts, its rank and its
  options' counts include automated parts the same way, with nothing to tell
  a person's pick from a planner's, and no event records which action placed
  it. A share that measures a person's choice keeps its own denominator
  instead, so automated parts can't dilute it.
- **A download is recorded when the export starts.** That is the request that
  carries the selection and source; the file route knows only the
  translation. An export Onshape later fails still counts, as an insert whose
  fasten fails still does.
- **The rollup columns keep their insert names.** `insert_count`,
  `first_inserted_at` and `last_inserted_at` count every use; renaming a column
  in D1 rebuilds its table for no reader's benefit, so the code's names say
  uses and the columns' say inserts.
- **The overview is one route per area.** One request computing everything
  failed whole when any query did, showed nothing until the slowest finished,
  and held D1 for all of it at once. Per area, a section fails or waits on its
  own, and its zero state says which.
- **Indexes for the dashboard's reads.** D1 runs one query at a time per
  database, so a slow read queues every other, the app's included, until D1
  refuses them. `favorites_insertable_idx` serves the parts table's favorite
  counts, which otherwise scan every favorite per part, and
  `daily_app_opens_day_opens_idx` covers summing a range's opens, which the
  primary key's index can't. At a season's volume they take the overview
  page's reads from about 3 s to under 0.4 s.
- **A log plus rollups.** The log keeps everything for replay; rollups keep every
  dashboard read a small indexed query.
- **Keyed by element, not insertable.** An insertable row is replaced when a tab
  is removed and re-added; its element id is not.
- **Public aggregates.** The numbers are useful to the community, and nothing
  per-user is exposed.
- **The module isn't called `events.ts`.** Ad blockers match an `events-<hash>.js`
  chunk, and the frontend imports its enums.

_Last reviewed: 2026-11-07_
