/** As the `WxH` Onshape wants. SMALL is for list rows; LARGE for hover cards and the insert preview. */
export enum ThumbnailSize {
    SMALL = "70x40",
    LARGE = "300x300"
}

/** An element's two stored thumbnail URLs, returned once both are stored. */
export interface ThumbnailUrls {
    small: string;
    large: string;
}
