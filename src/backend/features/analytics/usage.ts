/**
 * The vocabulary of what gets recorded. Named for what it describes rather than
 * for the events themselves: as `events.ts` it built to an `events-<hash>.js`
 * chunk, and the frontend imports these enums, so an ad blocker that matches
 * that name takes the main entry and the library route down with it. That is
 * what blocked it in dev, where the url carries the path as written.
 */

/**
 * What a logged event's columns mean. Bump it when that changes, so a reader can
 * tell rows written under the old reading from rows written under the new.
 */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * The kinds of usage events recorded for the analytics dashboard.
 */
export enum EventType {
    INSERT = "insert",
    APP_OPEN = "app_open"
}

/**
 * Where an insert started, not whether the part is favorited. One value per place
 * rather than a source crossed with a location: only search has two forms.
 */
export enum InsertSource {
    /** Searching the whole library, from its home list. */
    SEARCH = "search",
    /** Searching inside one group, which filters the results to it. */
    GROUP_SEARCH = "group_search",
    /** The group's own list of parts. */
    BROWSE = "browse",
    FAVORITES = "favorites"
}
