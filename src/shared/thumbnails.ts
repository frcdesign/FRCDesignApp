/** Thumbnail addressing, shared so the client builds the urls the worker serves. */
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY
} from "./canonical-configuration";
import { ThumbnailSize } from "./types";

/** Short on purpose: the real render can land at any moment and must take over. */
export const THUMBNAIL_FALLBACK_CACHE_TTL = 60;

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
}

/** The app URL serving a thumbnail; `v` busts caches when the document changes. */
export function thumbnailUrl({
    elementId,
    microversionId,
    size,
    canonicalConfiguration,
    warm
}: ThumbnailUrlOptions): string {
    const query = new URLSearchParams({ v: microversionId });
    if (canonicalConfiguration !== DEFAULT_CANONICAL_CONFIGURATION) {
        query.set("c", canonicalConfiguration);
        if (warm) {
            query.set("warm", "true");
        }
    }
    return `/api/thumbnail/${size}/${elementId}?${query}`;
}

/** What identifies one configuration's thumbnails to render. */
export interface ThumbnailParams {
    elementId: string;
    microversionId: string;
    /** Never the default, which loads eagerly with the element. */
    canonicalConfiguration: string;
}
