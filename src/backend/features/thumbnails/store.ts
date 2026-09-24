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

interface ThumbnailMetadata extends Record<string, string> {
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
 * Skips sizes already stored; throws while Onshape hasn't rendered. Keyed by
 * the version's microversion though read from its branch, assuming an unedited
 * branch renders the same.
 */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    thumbnailPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const { elementId } = thumbnailPath;

    // Sequential, so a failed attempt costs one call.
    for (const size of BOTH_SIZES) {
        const key = thumbnailKey(elementId, microversionId, size);
        if (await bucket.head(key)) {
            continue;
        }
        const thumbnail = await getElementThumbnail(
            onshapeApi,
            thumbnailPath,
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
