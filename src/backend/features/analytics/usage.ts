/**
 * Not named `events.ts`: ad blockers match the `events-<hash>.js` chunk, and
 * the frontend imports these enums.
 */

/** Bump when the columns' meaning changes. */
export const EVENT_SCHEMA_VERSION = 4;

/** Rows imported from the legacy app's log; see `scripts/migrate-analytics`. */
export const LEGACY_SCHEMA_VERSION = 0;

export enum EventType {
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
    DEFAULT_SELECTION = "default_selection",
    /** An assembly's masses read; see `features/mass-analysis`. Not a use. */
    MASS_REPORT = "mass_report"
}

/** A use is an insert or a download: each counts toward a part's usage. */
export const USE_EVENT_TYPES = [EventType.INSERT, EventType.DOWNLOAD] as const;

/**
 * Where a used part went. An insert's is the kind of tab it landed in, which
 * share `ElementType`'s values, so its rows read either way.
 */
export enum UseTarget {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY",
    DOWNLOAD = "DOWNLOAD"
}

/** Where the use started, not whether the part is favorited. */
export enum UseSource {
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
export const CLIENT_USE_SOURCES = [
    UseSource.SEARCH,
    UseSource.GROUP_SEARCH,
    UseSource.BROWSE,
    UseSource.FAVORITES,
    UseSource.RECENTS
] as const;

/**
 * A feature whose reach the dashboard charts: the share of a week's active
 * users who used it that week. `featuresOf` says which events count.
 */
export enum AppFeature {
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
    MASS_ANALYSIS = "mass_analysis",
    REPORT = "report"
}
