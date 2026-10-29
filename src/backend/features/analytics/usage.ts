/**
 * Not named `events.ts`: ad blockers match the `events-<hash>.js` chunk, and
 * the frontend imports these enums.
 */

/** Bump when the columns' meaning changes. */
export const EVENT_SCHEMA_VERSION = 2;

export enum EventType {
    INSERT = "insert",
    APP_OPEN = "app_open",
    /** One finished push or pull; see `features/version-manager`. */
    VERSION_RUN = "version_run"
}

/** Not whether the part is favorited. */
export enum InsertSource {
    /** Searching the whole library, from its home list. */
    SEARCH = "search",
    /** Searching inside one group, which filters the results to it. */
    GROUP_SEARCH = "group_search",
    /** The group's own list of parts. */
    BROWSE = "browse",
    FAVORITES = "favorites"
}
