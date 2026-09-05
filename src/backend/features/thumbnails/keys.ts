/** Thumbnail addressing, shared so the client builds the urls the worker serves. */
import { ELEMENT_DEFAULT_KEY } from "../configurations/selection";
import { ThumbnailSize } from "./types";

/** Marks a response as the element default standing in for an unrendered configuration. */
export const THUMBNAIL_FALLBACK_HEADER = "X-Thumbnail-Fallback";

/**
 * Defaults get their own prefix: everything falls back to them, so they never
 * expire. A configuration is url-encoded into its segment, the way Onshape
 * spells one, which keeps `/` and `;` out of the path.
 */
export function thumbnailKey(
    elementId: string,
    microversionId: string,
    size: ThumbnailSize,
    configurationKey: string = ELEMENT_DEFAULT_KEY
): string {
    if (configurationKey === ELEMENT_DEFAULT_KEY) {
        return `thumbnails/default/${elementId}/${microversionId}/${size}`;
    }
    const segment = encodeURIComponent(configurationKey);
    return `thumbnails/config/${elementId}/${microversionId}/${segment}/${size}`;
}

export interface ThumbnailUrlOptions {
    elementId: string;
    microversionId: string;
    size: ThumbnailSize;
    /** Empty (the default) serves the element's own thumbnail. */
    configurationKey: string;
    /** Whether a miss should start rendering this configuration. */
    renderThumbnail?: boolean;
    /** Only needed to render: what the render resolves the element from. */
    insertableId?: string;
    /**
     * Which poll this is. The worker ignores it; it is what keeps each poll off
     * the browser's image cache, which serves a url for the page's lifetime.
     */
    attempt?: number;
}

/** The app URL serving a thumbnail; `v` busts caches when the document changes. */
export function thumbnailUrl({
    elementId,
    microversionId,
    size,
    configurationKey,
    renderThumbnail,
    insertableId,
    attempt
}: ThumbnailUrlOptions): string {
    // `v` is the one abbreviation: it is the cache version every immutable url
    // carries, and a render is pinned to the microversion it was taken from.
    const query = new URLSearchParams({ v: microversionId });
    if (configurationKey !== ELEMENT_DEFAULT_KEY) {
        query.set("configurationKey", configurationKey);
        if (renderThumbnail && insertableId) {
            query.set("renderThumbnail", "true");
            query.set("insertableId", insertableId);
        }
        // Omitted on the first, so it shares a url with everything else asking
        // for this configuration.
        if (attempt) {
            query.set("attempt", attempt.toString());
        }
    }
    return `/api/thumbnail/${size}/${elementId}?${query.toString()}`;
}
