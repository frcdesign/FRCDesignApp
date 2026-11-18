# Analytics and the dashboard

## Purpose

Records how the libraries are used — each **use** of a part, an insert into
Onshape or a STEP download, and each launch from Onshape —
how often people report problems, and who uses each of the app's features, and shows it on a public dashboard: totals and trends, per-library health,
which parts and configuration options are used, and which aren't. It exists so
the library team can see what to maintain and what to cut.

It records nothing a user sees back about themselves, and reports only
aggregates.

## Code map

In the order an event travels: recorded, logged, rolled up, read, drawn.

`src/backend/features/analytics/usage.ts`, a leaf module the frontend also
imports

```ts
/** Bump when the columns' meaning changes. */
const EVENT_SCHEMA_VERSION = 3;

/** Rows imported from the legacy app's log; see Imported history. */
const LEGACY_SCHEMA_VERSION = 0;

enum EventType {
    INSERT = "insert",
    /** A part exported to a STEP file; see `features/download`. */
    DOWNLOAD = "download",
    APP_OPEN = "app_open",
    /** One finished push or pull; see `features/version-manager`. */
    VERSION_RUN = "version_run",
    /** One report posted to Discord; see `features/feedback`. */
    REPORT = "report",
    /** One FeatureScript added to a Part Studio; see `features/featurescripts`. Not a use. */
    FEATURE_ADD = "feature_add",
    /** A favorite's default configuration saved; see `features/favorites`. Not a use. */
    DEFAULT_SELECTION = "default_selection"
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
    RECENTS = "recents",
    /** An Auto Assembly run, which inserts a part per fastener it places. */
    AUTO_ASSEMBLY = "auto_assembly",
    /** Imported from the legacy app's log, which never recorded where a use started. */
    UNKNOWN = "unknown"
}

/** What a client may send: the import is the only writer of `UNKNOWN`. */
const CLIENT_USE_SOURCES: readonly UseSource[];

/** A feature whose reach the dashboard charts; `featuresOf` says which events count. */
enum AppFeature {
    /** A use started from a search, the library's or a group's. */
    SEARCH = "search",
    FAVORITES = "favorites",
    RECENTS = "recents",
    QUICK_INSERT = "quick_insert",
    FASTEN = "fasten",
    /** Fastened to circular edges or faces picked in Onshape beforehand. */
    PRESELECTION = "preselection",
    INSERT_LOCATION = "insert_location",
    AUTO_ASSEMBLY = "auto_assembly",
    DOWNLOAD = "download",
    DEFAULT_CONFIGURATION = "default_configuration",
    VERSION_MANAGER = "version_manager",
    FEATURESCRIPTS = "featurescripts",
    REPORT = "report"
}
```

`src/backend/features/analytics/tracking.ts`, called by the routes and the
workflow that did the work

```ts
// In the background, after the response; see Recording. Each of the
// `instances` an insert placed is a use of its own.
function trackInsert(
    c: AppContext,
    event: InsertEvent,
    instances = 1
): Promise<void>;
function trackDownload(c: AppContext, event: UseEvent): Promise<void>;
function trackAppOpen(c: AppContext): Promise<void>;
function trackReport(c: AppContext, event: ReportEvent): Promise<void>;
function trackDefaultSelection(
    c: AppContext,
    event: DefaultSelectionEvent
): Promise<void>;
// Awaited inside the workflow's `record-run` step, which swallows its failure.
async function trackVersionRun(
    env: AppBindings,
    event: VersionRunEvent
): Promise<void>;
// Awaited by Auto Assembly's `record-inserts` step: one event per part.
async function recordInserts(
    db: Db,
    userId: string,
    inserts: InsertEvent[]
): Promise<void>;
// The event and its rollup rows in one D1 batch; `recordBatch` for several.
function record(
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
    /** Whether the part offered insert and fasten. */
    fastenable: boolean;
    /** Fastened to circular edges or faces picked in Onshape beforehand. */
    preselected: boolean;
    /** Placed at the assembly's insert location marker. */
    atInsertLocation: boolean;
}

/** A favorite's default configuration, saved; `path` is its part in the loaded version. */
interface DefaultSelectionEvent {
    libraryId: LibraryId;
    path: ElementPath;
    insertableId: string;
}

/** A finished push or pull; see `features/version-manager`. */
interface VersionRunEvent {
    userId: string;
    kind: VersionJobKind;
    scope: PushScopeKind | PullScopeKind;
    /** How it ended. */
    status: VersionJobStatus;
}

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
```

`src/backend/features/analytics/event-log.ts`, a module scripts also import

```ts
// The columns every event has, and the rest as JSON under their D1 names.
function toLogRecord(event: LoggedEvent): EventLogRecord;
// A no-op where no stream is bound, as in local dev and tests.
async function logEvents(
    env: { EVENT_LOG?: EventLog },
    logged: LoggedEvent[]
): Promise<void>;
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
    /** Null before schema version 3. Whether the part offered insert and fasten. */
    fastenable: boolean | null;
    /** Null before schema version 3. Fastened to picks made beforehand. */
    preselected: boolean | null;
    /** Null before schema version 4. Placed at the assembly's insert location marker. */
    atInsertLocation: boolean | null;
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
};
```

`src/backend/features/analytics/logged-event.ts`, the one place that knows
which columns each kind of event sets

```ts
// Each narrows a row to its kind; undefined for any other.
function asUse(event: LoggedEvent): LoggedUse | undefined;
function asFeatureAdd(event: LoggedEvent): LoggedFeatureAdd | undefined;
function asVersionRun(event: LoggedEvent): LoggedVersionRun | undefined;
function asReport(event: LoggedEvent): LoggedReport | undefined;

/** Who sent a report, when they weren't signed in. */
const SIGNED_OUT_USER_ID = "signed-out";

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

// Every column of its group set to null, spelled out so a new column fails to
// compile until each kind of event says what it holds.
const NOT_A_USE: UseColumns;
const NO_ELEMENT: ElementColumns;
const NOT_A_VERSION_RUN: VersionRunColumns;
const NOT_A_REPORT: ReportColumns;
const NOT_A_FEATURE_ADD: FeatureAddColumns;

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
// `feature-reach.ts`: the features one event is a use of, which `rollupWrites`
// marks in `daily_feature_users`.
function featuresOf(event: LoggedEvent): AppFeature[];
```

`src/backend/features/analytics/routes.ts`, public and read-only. Every route
but health takes `from` and `to` day keys (`rangeQuery`); the overview and a
library's summary and feature usage clamp them to when tracking began (`clampRange`,
`getTrackingSince`).

```text
GET /api/analytics/overview/usage?trendFrom=                        OverviewUsageOut, its trends from trendFrom
GET /api/analytics/overview/series                                  DailyUsePoint[], per library
GET /api/analytics/overview/sources                                 UseSourceUsage[]
GET /api/analytics/overview/version-manager                         VersionManagerTotals
GET /api/analytics/overview/featurescripts                          FeatureScriptUsageOut
GET /api/analytics/overview/feature-reach                           FeatureReachOut
GET /api/analytics/overview/health                                  LibraryHealthCounts, every library's
GET /api/analytics/overview/reports                                 ReportSummary
GET /api/analytics/summary/library/:libraryId                       LibrarySummaryOut
GET /api/analytics/health/library/:libraryId?v=                     LibraryHealthCounts, cached by the library's version
GET /api/analytics/parts/library/:libraryId                         PartUsageOut[]
GET /api/analytics/unused/library/:libraryId?threshold=             PartUsageOut[], at or below the threshold
GET /api/analytics/unused-options/library/:libraryId?threshold=     UnusedOptionOut[]
GET /api/analytics/insertable/library/:libraryId/element/:elementId InsertableReportOut
```

`src/backend/features/analytics/metric-queries.ts`, `growth.ts`,
`part-queries.ts`, `report-queries.ts`, `featurescript-queries.ts` and
`feature-reach.ts`, the reads behind them

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
// Every feature in the document, at zero if unused, and any added since removed.
async function getFeatureScriptUsage(
    db: Db,
    range: DayRange
): Promise<FeatureScriptUsageOut>;
// Who was about each day: library activity unioned with app opens.
function activeUserRows(db: Db, range: DayRange, libraryId?: LibraryId);
// How many of them over the whole range: a union of ids, which dedupes them.
async function countActiveUsers(
    db: Db,
    range: DayRange,
    libraryId?: LibraryId
): Promise<number>;
// All time compares seasons; a shorter range, as many days just before it.
function getGrowthFor(
    db: Db,
    requested: DayRange,
    trackingSince: string | undefined,
    libraryId?: LibraryId
): Promise<GrowthOut>;
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
// `health.ts`: build-issue and part counts, hidden elements left out; every
// library's together without a `libraryId`.
async function getHealthCounts(
    db: Db,
    libraryId?: LibraryId
): Promise<LibraryHealthCounts>;
// `feature-reach.ts`: each week's active users and each feature's users among
// them, all and only the new, and each feature's first recorded use.
async function getFeatureReach(
    db: Db,
    range: DayRange,
    trackingSince: string | undefined
): Promise<FeatureReachOut>;

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

/** Lifetime counts, either overall or scoped to one library. */
interface AnalyticsTotals {
    /** Inserts and downloads; `targets` splits them. */
    uses: number;
    /** App-wide only; zero for a library. */
    appOpens: number;
    uniqueUsers: number;
    /** A subset of `uses`. */
    favoriteUses: number;
    /** A subset of the inserts, from a row's own Insert or Derive button. */
    quickInserts: number;
    /** Into an assembly, of a part offering insert and fasten when it was inserted; the base of the next two. */
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
    targets: UseTargets;
}

/** Lifetime uses started from one part of the app. */
interface UseSourceUsage {
    source: UseSource;
    count: number;
    /** How many of those were quick inserts, from a row's own Insert or Derive button. */
    quickInsertCount: number;
}

/** Severity counts are of issues; `healthyItems` counts items. */
interface LibraryHealthCounts {
    groupCount: number;
    insertableCount: number;
    /** The two split `insertableCount` by the kind of tab. */
    partStudioCount: number;
    assemblyCount: number;
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

/** What the Version Manager has done, and how much is linked to do it with. */
interface VersionManagerTotals {
    /** Pushes and pulls together. */
    runs: number;
    /** Tabs whose references the app repointed. */
    updatedElements: number;
    createdVersions: number;
    /** Current, not over the range: a link is state, not an event. */
    links: number;
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

/** One FeatureScript's adds over the range. */
interface FeatureScriptUsage {
    /** The feature's constant, which never changes once released. */
    featureType: string;
    /** Absent for a feature no longer in the frontend document. */
    name?: string;
    adds: number;
    users: number;
}

/** FeatureScripts added over the range, in total and per feature. */
interface FeatureScriptUsageOut {
    adds: number;
    /** Distinct over the range, so not the sum of the features'. */
    users: number;
    /** Every feature in the document, at zero if unused, most added first. */
    features: FeatureScriptUsage[];
}

/** How recently a person must have been first seen to count as new: this week or the three before. */
const NEW_USER_WEEKS = 4;

/** One week of feature usage: who was about, and who used each feature. */
interface FeatureReachWeek {
    /** The Monday it starts on, which may fall before the range does. */
    week: string;
    /** Everybody active that week, every feature's users among them. */
    activeUsers: number;
    /** Distinct users of each feature that week; a feature nobody used is absent. */
    users: Partial<Record<AppFeature, number>>;
    /** Of `activeUsers`, the new; absent while the window reaches back to when tracking began. */
    newActiveUsers?: number;
    /** Of `users`, the new; set whenever `newActiveUsers` is. */
    newUsers?: Partial<Record<AppFeature, number>>;
}

/** Each week of the range, oldest first, and where each feature's record starts. */
interface FeatureReachOut {
    weeks: FeatureReachWeek[];
    /** Each feature's first recorded use, all time; absent for one never used. */
    firstUsed: Partial<Record<AppFeature, string>>;
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

`scripts/migrate-analytics/`, run once: the legacy app's log, from BigQuery
into `events` and the rollups; see Imported history

```text
export.py      BigQuery to JSONL, one row per logged insert or app open
build-sql.ts   JSONL to SQL files, each a run of days applied as one import
```

`src/backend/features/download/routes.ts` and `src/backend/features/entry/routes.ts`,
two of the routes that record

```text
POST /api/step-export/insertable/:insertableId    trackDownload, once Onshape accepts the export
POST /api/app-open                                trackAppOpen, sent by /init's handoff
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
function getOverviewFeatureScriptsQuery(range: DayRange);
function getOverviewReportsQuery(range: DayRange);
function getOverviewFeatureReachQuery(range: DayRange);
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
function getOverviewHealthQuery();
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

`src/frontend/features/dashboard/nudges.ts`, every nudge toward a feature and
the day it shipped; `feature-reach.ts` turns the route's weeks into each
feature's line and places the nudges on it; `feature-reach-section.tsx` draws
them

```ts
const NUDGES: readonly Nudge[];

interface Nudge {
    feature: AppFeature;
    kind: NudgeKind; // a blue dot, or a tip toast
    change: NudgeChange; // added, or removed
    /** The day it reached `main`, which deploys to production; absent until then. */
    day?: string;
}

// Share of active users, or a count of users, per feature.
function featureMeasure(feature: AppFeature): ReachMeasure;
// Values per week in that measure, of everybody, the new and the existing;
// null before the feature's first recorded use, for a share of nobody, or
// where new users can't be told apart.
function toReachSeries(
    out: FeatureReachOut,
    feature: AppFeature,
    measure?: ReachMeasure
): ReachPoint[];
// A marker per week the feature's nudges changed in, labelled by kind.
function nudgeMarks(
    feature: AppFeature,
    points: ReachPoint[],
    nudges?: readonly Nudge[]
): { bucket: string; label: string }[];
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

type MetricKey = "uses" | "assemblyFraction";

interface MetricDefinition {
    key: MetricKey;
    label: string;
    /** Percentages divide by `denominator`; counts leave it undefined. */
    numerator: (point: DailyMetricPoint) => number;
    denominator?: (point: DailyMetricPoint) => number;
    /** What the detail chart's y-axis is measuring. */
    detailLabel: string;
}
```

| Metric             | Counts                | Divided by |
| ------------------ | --------------------- | ---------- |
| `uses`             | Inserts and downloads | —          |
| `assemblyFraction` | Uses into an assembly | Every use  |

`src/frontend/features/dashboard/use-mix.tsx`, the breakdowns

```tsx
// Where uses started from, each as a fraction of every use.
function UseSourceBreakdown(props: { sources: UseSourceUsage[] }): ReactNode;
// Every insert, by how it was made: the insert menu, quick insert or Auto Assembly.
function InsertMethodBreakdown(props: { totals: AnalyticsTotals }): ReactNode;
// Inserts into an assembly of a part offering insert and fasten, by how each was
// placed: normally, fastened to preselected edges, or by Auto Assembly.
function FastenMethodBreakdown(props: { totals: AnalyticsTotals }): ReactNode;
```

`src/backend/features/auto-assembly/track-inserts.ts`

```ts
// A run's parts, as inserts from the library each studio is in.
async function recordRunInserts(
    db: Db,
    userId: string,
    set: FastenerSet,
    parts: PartPlacement[],
    paths: (string[] | null)[],
    mated: Set<number>
): Promise<void>;
```

Named, not copied: `AppContext` and `AppBindings` (`src/backend/lib/context.ts`),
`Db` (`src/backend/db/client.ts`), `ElementPath` and `InstanceType`
(`src/backend/lib/onshape/path.ts`), `ElementType`, `LibraryId`, `Selection`
and `ConfigurationParameter` ([configurations.md](./configurations.md)), the
Version Manager's `VersionJobKind`, `VersionJobOutcome`, `VersionJobStatus`,
`PushScopeKind` and `PullScopeKind` ([version-manager.md](./version-manager.md)),
and feedback's `FeedbackTopic`, `FeedbackCategory` and `FeedbackSource`
([feedback.md](./feedback.md)).

## Storage

**The event log**, a Pipelines stream (`EVENT_LOG`) that writes an Iceberg
table, `analytics.events`, to the R2 bucket `frc-design-app-<env>-events`:

- One row per event. The columns every event has are columns of their own:
  `id`, `type`, `created_at` (epoch ms), `day`, `user_id`, `library_id` and
  `schema_version`. The rest is JSON in `data`, under its D1 column names
  (`toLogRecord`). The stream's schema can't change once made, so a new
  column goes in `data`.
- Pipelines adds `__ingest_ts` and partitions by its day, and writes files
  every five minutes. Nothing in the running app reads it.
- `scripts/event-log/` creates an environment's stream, sink and pipeline
  (`setup.sh`), and moves D1's `events` into it (`move-events.ts`).

**D1**, in `features/analytics/schema.ts` (kept apart from `db/schema.ts`, since
no foreign key crosses between them):

- `events` — the log's earlier home, kept until `move-events.ts` has moved
  it; nothing writes it. Its columns are the event's. Every event has an id, type, time, day key,
  user and schema version, and the library where it has one; a use adds the
  element path, insertable, canonical selection, source and favorite flag, and
  an insert also its target tab type and the quick-insert, fasten, fastenable
  (the part offered insert and fasten), preselected (fastened to picks made
  beforehand) and insert-location flags, which a download leaves null; an Auto
  Assembly run's inserts have source `auto_assembly`; a version run adds its kind,
  scope, whether it was update-only, its outcome, and how many steps failed,
  versions it created and tabs it updated. A report adds its topic, category,
  source and the team number the reporter gave, a part report the element
  path and insertable, and a report naming a FeatureScript its constant in
  `feature_type`. A FeatureScript add has its feature's constant in
  `feature_type`, and its Feature Studio's path in the loaded version in the
  element columns. A default configuration saved on a favorite has its library
  and its part's path and insertable. Keyed on
  Onshape's element id with no foreign keys, so history survives a reload or a
  re-added tab.
- Rows imported from the legacy app (see Imported history) have
  `schema_version` 0 (`LEGACY_SCHEMA_VERSION`), an id of `legacy-` and the
  Cloud Logging entry's `insert_id`, and `source` `unknown`. Their `instance_id`
  is the version inserted from; `document_id` and `insertable_id` are filled
  from the part as it is now, and null for a part since removed. A use credited
  to a re-created part carries that part's element id and no version.
- `library_id` is null for an event that belongs to no library: an app open,
  which is the app being opened rather than the page it resumes into, a
  version run, which acts on the Onshape document the app was launched from,
  a FeatureScript add, and a report about the app itself or the FeatureScripts. A report from somebody signed out has
  `user_id` `signed-out` (`SIGNED_OUT_USER_ID`).
- Rollups, each derived from the log alone: `daily_metrics`,
  `daily_target_metrics`, `daily_source_metrics`, `insertable_stats`,
  `daily_insertable_metrics`, `daily_insertable_users`,
  `daily_configuration_metrics`, `daily_user_activity`, `user_stats`,
  `daily_app_opens`, `daily_version_metrics`, `daily_report_metrics`,
  `daily_featurescript_metrics`, `daily_featurescript_users`,
  `daily_feature_users`.
- A use writes every library rollup, an insert and a download alike.
  `daily_metrics` keeps a row per event type, so the uses are the sum of the
  `insert` and `download` rows and either can be read alone. Beside its
  favorite, fasten and quick-insert counts it keeps, of inserts into an
  assembly of a part offering insert and fasten, `fastenable_count`, with the
  `preselected_count` and `auto_assembly_count` inside it.
  `daily_target_metrics` and `daily_insertable_metrics` split by `UseTarget`:
  an insert's target tab type (`PARTSTUDIO`, `ASSEMBLY`, the same strings as
  `ElementType`), or `DOWNLOAD`. The targets sum to the uses.
- `insertable_stats` and `user_stats` count every use in `insert_count`, and
  `insertable_stats` dates them in `first_inserted_at` and `last_inserted_at`;
  the code reads them as `useCount`, `firstUsedAt` and `lastUsedAt`.
- `daily_version_metrics` is keyed by day: runs, update-only runs, runs that
  partially failed and runs that failed outright, versions created and tabs
  updated.
- `daily_featurescript_metrics` is keyed by day and feature type: the count of
  adds. `daily_featurescript_users` holds who added each feature on a day, so
  distinct users come from rollups. Keyed by the feature's constant, which
  never changes once released, rather than its row.
- `daily_report_metrics` is keyed by day, topic, category, source and element
  (empty for a report that names no part): the count of reports. By topic
  rather than library, since the app's topics belong to none.
- `daily_app_opens` is keyed by day and user: the count is the app's sessions,
  and the user id is what makes somebody who only ever opened it a user. Every
  app-level count of people is that table unioned with `daily_user_activity`
  (`activeUserRows`), since a library rollup has no row for them. It is also
  indexed on day and opens (`daily_app_opens_day_opens_idx`), so a range's
  opens sum from the index alone.
- `daily_feature_users` is keyed by feature, day and user: who used each
  `AppFeature` that day, as `featuresOf` decides from the event. Feature first,
  so a feature's first recorded day is an index seek. Any kind of event can
  write it: a use by where it started and its flags, a version run, a
  FeatureScript add, a signed-in report, a default configuration. An Auto
  Assembly run's uses count only toward `AUTO_ASSEMBLY`, not toward fasten or
  the other flags they set. It starts empty at migration
  `0015_feature_reach.sql`; `move-events.ts` fills it from the events it
  moves. `at_insert_location`
  and `default_selection` begin with it, at schema version 4.
- `users`, in `db/schema.ts`, is each person's record. `record` creates it,
  dated `created_at`, in the same batch as their first event that names a
  person (`namesPerson`): activity, an open, or a use of a feature. For most
  that is the open from Onshape. A favorite creates it too, for someone who
  favorites first.
- Its dead `library_id` must name a library, so the insert selects one
  through `libraries` and writes nothing where none exists.
- Migration `0015_feature_reach.sql` created a record for everybody the
  rollups name, dated noon UTC of their first day in
  `daily_user_activity`, `daily_app_opens` or `daily_feature_users`.
- `favorites`, in `db/schema.ts`, is read for each part's standing favorites,
  through its index on `insertable_id` (`favorites_insertable_idx`).

## Flows

### Recording

1. An insert route calls `trackInsert` once the insert succeeded, with how many
   instances it placed: an insert and fasten to picks places one per edge, and
   each is a use of its own, `preselected`. Auto Assembly's workflow calls
   `recordRunInserts` in its `record-inserts` step once fastening has ended,
   however it ended: each part it inserted is an insert from the library its
   studio is in, source `auto_assembly`, fastened if its mate was added, never
   favorited. The parts a run deletes to replace a screw aren't recorded;
   their replacements are inserts like any other;
   `POST /api/step-export` calls `trackDownload` once Onshape accepts the
   export (see [download.md](./download.md)); `/init`'s
   handoff calls `POST /api/app-open`, which calls `trackAppOpen`; the
   Version Manager's workflow calls `trackVersionRun` in its `record-run` step
   once its run has finished, so a run that failed halfway still records what
   it managed; `POST /api/update-references` records one in the background once
   it has updated a library document's references; `POST /api/feedback` calls `trackReport` once the report is
   posted to Discord (see [feedback.md](./feedback.md));
   `POST /api/featurescripts/:featureId/add` calls `trackFeatureAdd` once
   Onshape accepted the feature (see [featurescripts.md](./featurescripts.md));
   `POST /api/default-selection/favorite/:favoriteId` calls
   `trackDefaultSelection` once the default is saved (see
   [favorites.md](./favorites.md)).
2. A use, an open, a FeatureScript add, a report and a default configuration are recorded in the background (`runInBackground`),
   after the response; a workflow's step swallows a failure to record. So
   tracking never slows or fails what the user asked for.
3. The selection is stored canonically (`canonicalValues`), so `5 in` and
   `(2 + 3) in` count as one value.
4. `recordBatch` writes the events' rollup rows in one D1 batch, so none
   lands without the rest, one query against D1's per-invocation limit however
   many statements it holds. `record` does the same for one event.
5. Then it sends the events to the log (`logEvents`). A failed send is
   reported, not thrown: a workflow step retried for it would count its
   rollups twice.

### Imported history

Before the Worker, the Cloud Run app logged each insert and app open to Cloud
Logging, tagged `source: frc-design-app-data` and routed to a log bucket that
BigQuery links as `frc-design-lib.frc_design_app_data`. That log, 2025-11-14 to
2026-09-23, was imported once by `scripts/migrate-analytics/`:

1. `export.py` reads the inserts and app opens from BigQuery, deduplicated by
   `insert_id`.
2. `build-sql.ts` turns each into the `LoggedEvent` `trackInsert` or
   `trackAppOpen` would have written, and runs it through `rollupWrites` into a
   scratch SQLite database in the target's schema, so the rollups are the live
   write path's own.
3. It writes one SQL file per run of days: the events as plain inserts, then
   each rollup row as an upsert that merges with what the target holds, as the
   table's `onConflict` in `rollups.ts` would.
4. Each file is applied with `wrangler d1 execute --file`, which D1 runs as one
   import that lands whole or not at all.

The legacy log never recorded where an insert started, so every imported use
has `UseSource.UNKNOWN`. It logged an enum by its option's name, which is
matched back to an id against the part's parameters as they are now; a value
they can no longer place is left out of the selection, and the use still
counts. Its first weeks named no library; an element held by exactly one library
says which, and the rest are `frc-design-lib`, the only library then.

Some of the most used parts were re-created as new tabs after the log was
written, so their logged element ids no longer exist. A logged element the
library no longer holds is credited to the one part in that library with a
name it was inserted under, compared case-insensitively; with no such part, or
more than one, it keeps its own id and counts only in the totals.

`scripts/migrate-analytics/README.md` has the run's numbers.

### Days and seasons

A day key is the date in `America/New_York`, since US teams work evenings that
UTC midnight would split. Reports end yesterday: today is still filling, and
would dip every chart. On **All time**, growth compares a season's stretch
with the same stretch of the previous season (`seasons.ts`), since a
January–April competition year is nothing like a calendar year; between
seasons it shows the last complete one. A shorter range is the reader's own
window, so it is compared with the one just before it, season or not.

### Reporting

The dashboard is a sibling of `/app`, a full-screen page outside the Onshape
panel. Its routes read only rollups and return only aggregates:

- **Overview** — one route per area, each fetched by its own query, so every
  section shows as soon as its numbers arrive: **usage** (totals, the metric
  series behind the headline tiles, growth), **series**
  (uses per library per day, which the chart plots a day per point up to 90
  days and a week per point past that, `pickChartGranularity`), **sources**
  (every source, with "Not recorded" only when the range reaches imported
  history), **health** (every library's parts by kind and build issues,
  standing now), the **Version Manager**'s totals, **featurescripts** (adds and
  distinct users, and each feature's adds and users, every feature in the
  document listed), **feature usage** (`feature-reach`, below), and
  **reports**' totals. Its usage breakdown reads each library's **Parts**
  report.
- Under **How people use the app**, beside the sources, the usage route's
  totals draw two cards:
    - how every insert was made (`InsertMethodBreakdown`): the insert menu,
      quick insert or Auto Assembly;
    - how a part offering insert and fasten was placed
      (`FastenMethodBreakdown`): inserted normally, fastened to preselected
      edges, or by Auto Assembly. Its base is `fastenableInserts`, recorded on
      each event when it happens, so a part given fasten later doesn't
      undercount it.
- **Library** — its summary, health (parts, part studios and assemblies, and
  build issues by severity, hidden elements left out), its parts table, its reports' totals, and its most reported parts.
- **Part** — one element's history, the share of its uses that went
  into an assembly, and usage of each configuration option, split per way
  the option is shown (`toParameterInstances`).
- **Unused** — parts and options at or below a usage threshold.

The overview has no page-wide range. **Uses over time** and **Feature usage**
each pick their own (All time, 1 year or 90 days, `CHART_RANGE_PRESETS`;
90 days unless chosen), kept in the url as `usesRange` and `featureRange`.
**Overall** totals all time, and draws its sparklines and changes over the last
30 days (`trendFrom`). Every other section covers the last 30 days
(`OVERVIEW_TOTALS_PRESET`). Each says which beside its title; **Libraries** is
standing now. The library, part and
unused dashboards keep the range picker in the navbar, which the overview
hides.

**Feature usage** is one small chart per `AppFeature`: for each week of the
range, the share of that week's active users who used the feature that week,
on a shared 0–100% axis, or for search, STEP downloads and reports the number
of people who did, on an axis that fits it (`featureMeasure`). Active is `activeUserRows` unioned with the week's
feature users, so a share never passes 100%. Weeks are Monday to Sunday; the
first may begin before the range, and only its days inside it count. A
feature's line starts the week of its first recorded use, all time, and a week
with nobody about is left blank. A dashed line marks the week each of the
feature's nudges (`NUDGES`) shipped or was withdrawn; features with a nudge
come first. A nudge still on cert has no day and no marker until it reaches
`main`. The tooltip gives a share's users and active users beside it.

**New vs existing** (`reach=new-vs-existing` in the url) draws two lines per
chart in place of one. A person is new in a week when their first day
(`users.created_at`) falls in that week or the `NEW_USER_WEEKS` − 1 before it.
The week's window starts at UTC midnight, hours from the reporting day's.
Everybody else active that week is existing.
The split is left out of a week whose window starts on or before the day
tracking began, since somebody first seen then may have used the app long
before.

The ranges, threshold and views live in the url, so a view can be shared.

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

Every page's totals are over its range, and two numbers are not: the
favorites and linked documents standing now, which are state rather than events
and say so on the tile. Beside each headline number is its change
(`getGrowthFor`): on **All time** against the same stretch of the season
before, and on any shorter range against as many days just before it. Either
is withheld while its baseline reaches back before tracking began.

## Invariants

- Tracking never fails or delays the request it records.
- Analytics routes are public: they never call `getUserId()` or
  `getOnshapeApi()`, and never return anything about one user.
- Every rollup is derivable from the event log alone, so the rollups can be
  rebuilt by replaying it.
- The log never holds an event the rollups don't count.
- Besides `daily_feature_users`, which every event that is a use of an
  `AppFeature` writes, an event without a library writes one rollup and no
  other: `daily_app_opens` for an open, `daily_version_metrics` for a version
  run, and a FeatureScript add its two, `daily_featurescript_metrics` and
  `daily_featurescript_users`. A report writes `daily_report_metrics` alone,
  with a library or without, and a default configuration nothing else. Every
  other rollup is keyed by library.
- `featuresOf` is the one place that says which events are a use of which
  feature.
- Everybody a rollup names has a record in `users`, dated no later than the
  first day it names them.
- Every nudge toward a feature is in `NUDGES`, added in the change that ships
  or withdraws it.
- An event's columns are decided in `logged-event.ts`; a new column fails to
  compile until each kind of event says what it holds.
- Values are compared and counted canonically, never by configuration key.
- `UseSource.UNKNOWN` is written only by the import: a request's `source` is
  one of `CLIENT_USE_SOURCES`.
- Changing what a column means bumps `EVENT_SCHEMA_VERSION`.
- A use is one of `USE_EVENT_TYPES`, and writes every rollup any use writes;
  only its `UseTarget` and the insert-only flags tell the kinds apart. A count
  labelled "uses" sums them all; "inserts" means the uses that went into
  Onshape.
- A use is one part, inserted or downloaded. An action that places several
  parts — an insert and fasten to several picked edges, an Auto Assembly run —
  records one use per part, and every count of uses sums them, the headline
  numbers included.
- A share of a choice only a person makes divides by the uses that choice was
  open to, not by every use.
- Every new or major feature records its use here, in the same change
  (`AGENTS.md`, Feature tracking).

## Failure and recovery

| Failure                                       | Result                                                       | Recovery                                                            |
| --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| The tracking write fails                      | That event is lost; what it records is unaffected            | None needed                                                         |
| The event log can't be reached                | The rollups count the event; the log misses it               | None; the send's failure is logged                                  |
| A rollup is wrong after a code change         | Dashboard numbers off                                        | Replay the event log through `rollupWrites`; no script does this    |
| An import file fails part-way                 | D1 rolls the file back; the files before it stay applied     | Apply the same file again                                           |
| An import file is applied twice               | Refused on its first event's id; nothing counted twice       | None needed                                                         |
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
- **A FeatureScript add is not a use.** A feature is no library's part, so
  it counts toward no library's uses, users or parts, and rolls up into tables
  of its own; the owner reads them in each feature's card
  (`GET /api/featurescripts/stats`), and the overview's FeatureScripts section
  over the range.
- **The overview's charts pick their range; its totals don't.** One range for
  the whole page left Feature usage with one or two weekly points on 7 or 30
  days, and a chart is where a longer view is worth choosing. A total reads
  best over a window everyone knows without looking up, so each says which.
  The headline totals are all time, the app's size; its changes are recent,
  since an all-time change moves too slowly to notice.
- **Feature usage is weekly, over that week's active users.** The goal is
  every active user using each feature, so the share is of the people about
  that week, not of everyone ever seen, which only rises and is weighed down
  by people long gone. A day holds too few people for a share to mean much; a
  week is the shortest span that does, and a nudge that works shows as a step.
- **New means first seen in the last four weeks, across every rollup.** Four
  weeks covers a newcomer's first sessions without keeping them new for a
  whole season.
- **A person's record is created by their first event.** It dates everybody,
  standalone users included, which allows new users and growth in users over
  time. Working first days out from the rollups on each request reads every
  person's days and holds D1 for seconds.
- **Some features are counted, not shared.** Nobody should need to report an
  issue or download a STEP file, so a share of everybody has no target to
  reach; nearly everybody searches, so its share sits near the top and hides
  growth. Their charts count the week's users instead.
- **A feature's line starts at its first recorded use.** `daily_feature_users`
  is filled from history by `move-events.ts`, not by a migration: replaying
  2.8 million events outlasts D1's 30-second limit. Before a feature's first row nothing tells a week nobody used it
  from one nothing recorded, so the line is left blank rather than drawn at 0%.
  It costs the weeks before a new feature's first use, which read the same.
- **An Auto Assembly run's uses are Auto Assembly's alone.** A run's planner
  fastens the parts it places. Counting those toward Insert and fasten would
  credit a choice nobody made.
- **A default configuration is not activity.** Saving one places nothing, so
  like a report it writes no library rollup; it counts only toward its
  feature's reach.
- **Nudges are listed in code, dated by `main`.** A push to `main` deploys to
  production, so the day a change reached it is the day people first saw the
  nudge. Nothing records that on its own, and a list beside the chart is
  reviewed with the change that ships the nudge.
- **Reports are not activity.** Reporting a library's part is not using it, so
  a report writes no row to `daily_metrics`, `daily_user_activity` or
  `user_stats`, even when it names a library.
- **Version runs are not activity.** They write no row to `daily_user_activity`
  or `user_stats`, only to their own table and `daily_feature_users`: "active user" means somebody who used a part,
  and counting runs there would move the line under every historical
  figure. An open is activity, which is why it is unioned in.
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
- **Imported history keeps its gaps.** The legacy log never said where a use
  started, so its uses are `UNKNOWN` rather than spread over the sources in
  today's proportions, which would put a guess beside measured numbers.
  "Not recorded" shows only for a range that reaches them.
- **The import has no cut-off date.** The two backends ran side by side for
  two weeks of September 2026 while DNS moved, but each request reached one of
  them, so their logs hold different events and the overlap days are summed.
- **Imported options are matched against today's parameters.** The log kept an
  option's name, not its id, and only the current parameters survive. A
  renamed or removed option drops out of that use's selection rather than
  stopping the import, so a part's total stays right and only that option's
  tally misses it.
- **A log plus rollups.** The log keeps everything for replay; rollups keep every
  dashboard read a small indexed query.
- **The log is in R2, not D1.** Nothing in the running app reads it, and it
  grows without bound. In D1 a scan of it held the database, which runs one
  query at a time, for seconds, and outlasted a migration's 30-second limit.
  In R2 it costs nothing to keep and a query of it runs elsewhere.
- **Keyed by element, not insertable.** An insertable row is replaced when a tab
  is removed and re-added; its element id is not.
- **Imported history is credited to re-created parts by name.** The exception
  to keying by element: a fifth of the legacy log's uses are of tabs since
  re-created under new element ids, among them the most used parts. Left on
  their old ids those parts' pages would start in September 2026. The name is
  matched only within a library and only when one part has it, so a guess is
  never between parts.
- **Public aggregates.** The numbers are useful to the community, and nothing
  per-user is exposed.
- **Fastenable inserts are their own denominator.** Preselection and Auto
  Assembly only place parts that offer insert and fasten, into an assembly;
  measured against every insert they would read as rare however often they
  replace the alternative. Only events from schema version 3 carry
  `fastenable` and `preselected`, so the breakdown counts from then.
- **The module isn't called `events.ts`.** Ad blockers match an `events-<hash>.js`
  chunk, and the frontend imports its enums.

_Last reviewed: 2026-11-07_
