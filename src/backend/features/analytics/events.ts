/**
 * What the columns of a logged event mean. Bump it when that changes — a
 * column repurposed, or one whose meaning shifts — so a reader can tell rows
 * written under the old reading from rows written under the new one.
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
 * Where an insert started, not whether the part is favorited: a favorited part
 * inserted from search is `SEARCH`.
 *
 * One value per place a part can be inserted from, rather than a source crossed
 * with where the user was: browsing only happens inside a group and favorites
 * only outside one, so search is the only one of the three with two forms.
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
