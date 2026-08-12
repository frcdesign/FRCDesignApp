/**
 * Thumbnail addressing, shared so the client builds exactly the URLs the worker
 * serves, and so R2 keys have one definition.
 */
import {
    DEFAULT_CONFIGURATION_KEY,
    configurationKeyFor
} from "./configuration-utils";
import { ThumbnailSize } from "./types";

/** A stored thumbnail never changes, since its key pins the microversion. */
export const THUMBNAIL_CACHE_TTL = 30 * 24 * 3600;

/**
 * How long a fallback (the default configuration standing in for one we haven't
 * rendered yet) may be cached. Short on purpose: the real thumbnail can land at
 * any moment, and an `immutable` fallback would pin the wrong image for a month.
 */
export const THUMBNAIL_FALLBACK_CACHE_TTL = 60;

/**
 * The R2 key for a thumbnail. Default-configuration thumbnails live under their
 * own prefix because everything falls back to them, so only the `config/` prefix
 * carries an expiry lifecycle rule.
 */
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
    /** The encoded canonical configuration; omit or empty for the default. */
    configuration?: string;
    /** Whether a miss should kick off generating this configuration. */
    warm?: boolean;
}

/** The app URL serving a thumbnail; `v` busts caches when the document changes. */
export function thumbnailUrl({
    elementId,
    microversionId,
    size,
    configuration,
    warm
}: ThumbnailUrlOptions): string {
    const query = new URLSearchParams({ v: microversionId });
    if (configuration) {
        query.set("c", configuration);
        if (warm) {
            query.set("warm", "1");
        }
    }
    return `/api/thumbnail/${size}/${elementId}?${query}`;
}

/** The key identifying a configuration within an element's thumbnails. */
export function thumbnailConfigurationKey(configuration?: string): string {
    return configuration
        ? configurationKeyFor(configuration)
        : DEFAULT_CONFIGURATION_KEY;
}

/** What identifies one configuration's thumbnails to render. */
export interface ThumbnailParams {
    elementId: string;
    microversionId: string;
    /** The encoded canonical configuration; never empty (defaults load eagerly). */
    configuration: string;
}

/**
 * The workflow instance id for a configuration's render. Deterministic so two
 * requests for the same thumbnail collapse onto one run: Cloudflare rejects a
 * duplicate instance id, which is the coalescing we want.
 */
export function thumbnailWorkflowId(params: ThumbnailParams): string {
    const configurationKey = thumbnailConfigurationKey(params.configuration);
    return `thumbnail-${params.elementId}-${params.microversionId}-${configurationKey}`;
}
