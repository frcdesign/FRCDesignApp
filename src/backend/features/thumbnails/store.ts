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
 * One size, the version first and the document's workspace when it won't
 * answer: Onshape's version form of this endpoint is unreliable, its workspace
 * form isn't, and the version is what the library shows.
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

/** Skips sizes already stored; throws when neither instance gives one up. */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementWorkspacePath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const { elementId } = elementPath;

    // Sequential, so a failed attempt costs one call.
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
