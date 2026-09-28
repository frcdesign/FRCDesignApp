/** As the `WxH` Onshape wants. SMALL is for list rows; LARGE for hover cards and the insert preview. */
export enum ThumbnailSize {
    SMALL = "70x40",
    LARGE = "300x300"
}

/** What asking for a configuration's render found. */
export enum RenderStatus {
    /** Rendering, or already rendered; a push says when each size lands. */
    RENDERING = "rendering",
    /** The configuration regenerates into nothing, so no render is coming. */
    NO_PART = "no-part"
}

export interface RenderOut {
    status: RenderStatus;
}

/** An insertable's two stored thumbnail URLs, returned once both are stored. */
export interface ThumbnailUrls {
    small: string;
    large: string;
}
