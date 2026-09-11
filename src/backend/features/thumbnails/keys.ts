/** Thumbnail addressing, shared so the client builds the urls the worker serves. */
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/contract";
import { ThumbnailSize } from "./contract";

/** Everything a thumbnail is stored under, and what reconciliation scans. */
export const THUMBNAIL_PREFIX = "thumbnails/";

/**
 * Defaults get their own prefix, everything falling back to them so they never
 * expire. A configuration is url-encoded, keeping `/` and `;` out of the path.
 */
export function thumbnailKey(
    elementId: string,
    microversionId: string,
    size: ThumbnailSize,
    configurationKey: ConfigurationKey = DEFAULT_CONFIGURATION_KEY
): string {
    if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
        return `${THUMBNAIL_PREFIX}default/${elementId}/${microversionId}/${size}`;
    }
    const segment = encodeURIComponent(configurationKey);
    return `${THUMBNAIL_PREFIX}config/${elementId}/${microversionId}/${segment}/${size}`;
}

/**
 * What a stored thumbnail depicts. Both prefixes carry it in the same two
 * segments, so a configuration render lives and dies with its element's.
 */
export interface ThumbnailSubject {
    elementId: string;
    microversionId: string;
}

/** Keyed for set membership, since a pair cannot be compared by identity. */
export function subjectKey(subject: ThumbnailSubject): string {
    return `${subject.elementId}/${subject.microversionId}`;
}

/**
 * The element and microversion a key was written for, or undefined when the key
 * is not one {@link thumbnailKey} produces. Reconciliation deletes what this
 * resolves, so anything it does not recognize is left alone.
 */
export function parseThumbnailKey(key: string): ThumbnailSubject | undefined {
    if (!key.startsWith(THUMBNAIL_PREFIX)) {
        return undefined;
    }
    const [kind, elementId, microversionId, ...rest] = key
        .slice(THUMBNAIL_PREFIX.length)
        .split("/");
    // default/ ends with the size; config/ has the configuration before it.
    const expected = kind === "default" ? 1 : kind === "config" ? 2 : -1;
    if (rest.length !== expected || !elementId || !microversionId) {
        return undefined;
    }
    return { elementId, microversionId };
}

interface ThumbnailUrlOptions {
    elementId: string;
    microversionId: string;
    size: ThumbnailSize;
    /** Empty (the default) serves the element's own thumbnail. */
    configurationKey: ConfigurationKey;
    /** Whether a miss should start rendering this configuration. */
    renderThumbnail?: boolean;
    /** Only needed to render: what the render resolves the element from. */
    insertableId?: string;
}

/** The app URL serving a thumbnail; `v` busts caches when the document changes. */
export function thumbnailUrl({
    elementId,
    microversionId,
    size,
    configurationKey,
    renderThumbnail,
    insertableId
}: ThumbnailUrlOptions): string {
    // `v` is the one abbreviation: it is the cache version every immutable url
    // carries, and a render is pinned to the microversion it was taken from.
    const query = new URLSearchParams({ v: microversionId });
    if (configurationKey !== DEFAULT_CONFIGURATION_KEY) {
        query.set("configurationKey", configurationKey);
        if (renderThumbnail && insertableId) {
            query.set("renderThumbnail", "true");
            query.set("insertableId", insertableId);
        }
    }
    return `/api/thumbnail/${size}/${elementId}?${query.toString()}`;
}

/**
 * The subject of a url {@link thumbnailUrl} built. Groups record their document
 * thumbnail only as these two urls, so this is what tells reconciliation which
 * element and microversion they still stand for; `keys.test.ts` pins the pair.
 */
export function parseThumbnailUrl(url: string): ThumbnailSubject | undefined {
    // Relative, so it needs a base to parse against; the origin is discarded.
    const parsed = URL.parse(url, "https://x.invalid");
    if (!parsed) {
        return undefined;
    }
    const [, api, thumbnail, , elementId, ...rest] = parsed.pathname.split("/");
    const microversionId = parsed.searchParams.get("v");
    if (
        api !== "api" ||
        thumbnail !== "thumbnail" ||
        rest.length > 0 ||
        !elementId ||
        !microversionId
    ) {
        return undefined;
    }
    return { elementId, microversionId };
}
