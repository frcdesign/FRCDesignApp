/**
 * The kinds of usage events recorded for the analytics dashboard.
 */
export enum EventType {
    INSERT = "insert",
    APP_OPEN = "app_open"
}

/**
 * Which part of the app an insert started from.
 *
 * Distinct from an insert's `isFavorite` flag, which only says the part happens
 * to be favorited — a favorited part inserted from search is `SEARCH`.
 */
export enum InsertSource {
    SEARCH = "search",
    BROWSE = "browse",
    FAVORITES = "favorites"
}
