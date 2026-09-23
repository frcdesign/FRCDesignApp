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

/** Which surface asked for a render, which decides the size stored first. */
export enum RenderSource {
    INSERT_MENU = "insert",
    /** A row in a list — favorites, search results. */
    ROW = "row"
}

/**
 * The size each surface shows first. Both are always stored, so a row and the
 * hover card it opens cannot disagree, but the one on screen goes first.
 */
export const PREFERRED_SIZE: Record<RenderSource, ThumbnailSize> = {
    [RenderSource.INSERT_MENU]: ThumbnailSize.LARGE,
    [RenderSource.ROW]: ThumbnailSize.SMALL
};
