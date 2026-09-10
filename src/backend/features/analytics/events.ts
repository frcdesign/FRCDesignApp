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
 */
export enum InsertSource {
    SEARCH = "search",
    BROWSE = "browse",
    FAVORITES = "favorites"
}
