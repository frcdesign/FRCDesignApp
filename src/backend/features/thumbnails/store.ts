/**
 * Where thumbnails live in R2, and how a caller reads one back. Only
 * `ThumbnailRenderer` asks Onshape for one; this is the storage either side.
 */

import { CachePolicy, immutableCacheControl } from "../../lib/cache";

import { getElementThumbnail } from "../../lib/onshape/endpoints/thumbnails";
import { type ElementPath } from "../../lib/onshape/path";

import { ThumbnailSize, ThumbnailUrls } from "./contract";
import { thumbnailKey, thumbnailUrl } from "./keys";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/contract";
import { OnshapeApi } from "../../lib/onshape/client";

/**
 * What produced a stored thumbnail, tagged onto the R2 object. The key already
 * addresses it; this is for reading an object back and telling what it is.
 */
export interface ThumbnailMetadata extends Record<string, string> {
    microversionId: string;
    /** Empty for an element's own thumbnail, as everywhere else. */
    configurationKey: ConfigurationKey;
}

/** Stores one rendered thumbnail, tagging it with what produced it. */
export async function putThumbnail(
    bucket: R2Bucket,
    key: string,
    thumbnail: ArrayBuffer,
    metadata: ThumbnailMetadata
): Promise<void> {
    await bucket.put(key, thumbnail, {
        httpMetadata: {
            contentType: "image/gif",
            cacheControl: immutableCacheControl(CachePolicy.PUBLIC_CACHE)
        },
        customMetadata: metadata
    });
}

const BOTH_SIZES = [ThumbnailSize.SMALL, ThumbnailSize.LARGE];

/**
 * One size, the version first and the workspace when it will not answer.
 *
 * Any failure pivots, not just a 404: the version form of this endpoint has
 * been unreliable for element thumbnails and the workspace form has not, but
 * the version is what the library shows, so it is still asked first.
 */
async function fetchThumbnail(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementWorkspacePath: ElementPath,
    size: ThumbnailSize
): Promise<ArrayBuffer> {
    try {
        return await getElementThumbnail(onshapeApi, elementPath, size);
    } catch {
        return getElementThumbnail(onshapeApi, elementWorkspacePath, size);
    }
}

/**
 * Stores both sizes, skipping either the bucket already holds, and throws when
 * neither instance will give one up.
 *
 * Onshape renders these when a document is saved, so reading one starts no work
 * and races nothing — unlike a configuration, which `ThumbnailRenderer` has to
 * serialize. A load fetches them directly, several elements at a time.
 */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementWorkspacePath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const { elementId } = elementPath;

    // One size at a time: an attempt that fails should cost one call rather
    // than two, and what runs in parallel is elements, not their sizes.
    for (const size of BOTH_SIZES) {
        const key = thumbnailKey(elementId, microversionId, size);
        if (await bucket.head(key)) {
            continue;
        }
        const thumbnail = await fetchThumbnail(
            onshapeApi,
            elementPath,
            elementWorkspacePath,
            size
        );
        await putThumbnail(bucket, key, thumbnail, {
            microversionId,
            configurationKey: DEFAULT_CONFIGURATION_KEY
        });
    }

    return thumbnailUrls(elementId, microversionId);
}

/** The urls serving a subject's two sizes, whether or not they are stored yet. */
export function thumbnailUrls(
    elementId: string,
    microversionId: string,
    configurationKey: ConfigurationKey = DEFAULT_CONFIGURATION_KEY
): ThumbnailUrls {
    return {
        small: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.SMALL,
            configurationKey
        }),
        large: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.LARGE,
            configurationKey
        })
    };
}

/**
 * The urls for a subject, or null while either size is still rendering. Both or
 * neither, so nothing records half a pair.
 */
export async function readThumbnailUrls(
    bucket: R2Bucket,
    elementId: string,
    microversionId: string,
    configurationKey: ConfigurationKey = DEFAULT_CONFIGURATION_KEY
): Promise<ThumbnailUrls | null> {
    const stored = await Promise.all(
        BOTH_SIZES.map((size) =>
            bucket.head(
                thumbnailKey(elementId, microversionId, size, configurationKey)
            )
        )
    );
    if (stored.some((object) => object === null)) {
        return null;
    }
    return thumbnailUrls(elementId, microversionId, configurationKey);
}
