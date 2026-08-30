/** Thumbnail addressing, shared so the client builds the urls the worker serves. */
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/canonical";
import { ThumbnailSize } from "./types";

/**
 * Shorter than the client's poll, so each poll reaches the worker instead of
 * the browser cache replaying the stand-in the real render has replaced.
 */
export const THUMBNAIL_FALLBACK_CACHE_TTL = 3;

/** Marks a response as the element default standing in for an unrendered configuration. */
export const THUMBNAIL_FALLBACK_HEADER = "X-Thumbnail-Fallback";

/** Defaults get their own prefix: everything falls back to them, so they never expire. */
export function thumbnailKey(
    elementId: string,
    microversionId: string,
    size: ThumbnailSize,
    configurationKey: string = DEFAULT_CONFIGURATION_KEY
): string {
    if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
        return `thumbnails/default/${elementId}/${microversionId}/${size}`;
    }
    return `thumbnails/config/${elementId}/${microversionId}/${configurationKey}/${size}`;
}

export interface ThumbnailUrlOptions {
    elementId: string;
    microversionId: string;
    size: ThumbnailSize;
    /** Empty (the default) serves the element's own thumbnail. */
    canonicalConfiguration: string;
    /** Whether a miss should kick off generating this configuration. */
    warm?: boolean;
    /** Only needed to warm: it is what the render resolves the element from. */
    insertableId?: string;
}

/** The app URL serving a thumbnail; `v` busts caches when the document changes. */
export function thumbnailUrl({
    elementId,
    microversionId,
    size,
    canonicalConfiguration,
    warm,
    insertableId
}: ThumbnailUrlOptions): string {
    const query = new URLSearchParams({ v: microversionId });
    if (canonicalConfiguration !== DEFAULT_CANONICAL_CONFIGURATION) {
        query.set("c", canonicalConfiguration);
        if (warm && insertableId) {
            query.set("warm", "true");
            query.set("i", insertableId);
        }
    }
    return `/api/thumbnail/${size}/${elementId}?${query.toString()}`;
}
