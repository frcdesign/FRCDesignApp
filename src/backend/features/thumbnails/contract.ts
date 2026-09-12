/**
 * The two thumbnail sizes we generate and store, as the `WxH` Onshape wants.
 * SMALL fills list rows; LARGE fills the hover card and the insert preview.
 */
export enum ThumbnailSize {
    SMALL = "70x40",
    LARGE = "300x300"
}

/** An element's two stored thumbnail URLs, returned once both are stored. */
export interface ThumbnailUrls {
    small: string;
    large: string;
}

/**
 * Which surface asked for a render, which is what orders it in the queue every
 * request has to join. See `ThumbnailRenderer` for why there is a queue.
 */
export enum RenderSource {
    /** The only source that may take the render thread off a job holding it. */
    INSERT_MENU = "insert",
    /** A row in a list — favorites, search results. Waits its turn. */
    ROW = "row",
    /** A library load, which nobody is waiting on. */
    LOAD = "load"
}

/**
 * The size each surface shows first. Both are always queued, so a row and the
 * hover card it opens cannot disagree, but they are separate renders and only
 * one runs at a time — so which goes first is worth getting right.
 */
export const PREFERRED_SIZE: Record<RenderSource, ThumbnailSize> = {
    [RenderSource.INSERT_MENU]: ThumbnailSize.LARGE,
    [RenderSource.ROW]: ThumbnailSize.SMALL,
    [RenderSource.LOAD]: ThumbnailSize.SMALL
};
