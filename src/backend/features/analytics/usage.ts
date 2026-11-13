/**
 * Not named `events.ts`: ad blockers match the `events-<hash>.js` chunk, and
 * the frontend imports these enums.
 */

/** Bump when the columns' meaning changes. */
export const EVENT_SCHEMA_VERSION = 3;

export enum EventType {
    INSERT = "insert",
    /** A part exported to a file from the standalone app; see `features/download`. */
    DOWNLOAD = "download",
    APP_OPEN = "app_open",
    /** One finished push or pull; see `features/version-manager`. */
    VERSION_RUN = "version_run",
    /** One report posted to Discord; see `features/feedback`. */
    REPORT = "report"
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
    /** An edit, which inserts each copy it changes again; see `features/edit-parts`. */
    EDIT = "edit"
}
