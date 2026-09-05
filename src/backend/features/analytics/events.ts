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
