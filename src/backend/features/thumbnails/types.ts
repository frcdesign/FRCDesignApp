/**
 * The two thumbnail sizes we generate and store, as the `WxH` Onshape wants.
 * SMALL fills list rows; LARGE fills the hover card and the insert preview.
 */
export enum ThumbnailSize {
    SMALL = "70x40",
    LARGE = "300x300"
}

/** An element's two stored thumbnail URLs, produced (and stored) as a pair. */
export interface ThumbnailUrls {
    small: string;
    large: string;
}
