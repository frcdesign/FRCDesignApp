/**
 * Renders thumbnails through Onshape and stores them in R2. Kept out of the
 * routes so the load workflows can reach it without importing the app.
 */

import { CachePolicy, immutableCacheControl } from "../../lib/cache";

import {
    getElementThumbnail,
    getThumbnailFromId,
    getThumbnailId
} from "../../lib/onshape/endpoints/thumbnails";
import {
    getDocument,
    getContents
} from "../../lib/onshape/endpoints/documents";
import { type ElementPath, type InstancePath } from "../../lib/onshape/path";

import { ThumbnailSize, ThumbnailUrls } from "./types";
import { thumbnailKey, thumbnailUrl } from "./keys";
import { DEFAULT_CANONICAL_CONFIGURATION } from "../configurations/canonical";
import { OnshapeApi } from "../../lib/onshape/client";

/**
 * What produced a stored thumbnail, tagged onto the R2 object. The key already
 * addresses it; this is for reading an object back and telling what it is.
 */
export interface ThumbnailMetadata extends Record<string, string> {
    microversionId: string;
    /** Empty for an element's own thumbnail, as everywhere else. */
    canonicalConfiguration: string;
}

/** Stores one rendered thumbnail, tagging it with what produced it. */
async function putThumbnail(
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

/** Throws until Onshape has rendered them, which drives the load step's retries. */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const [small, large] = await Promise.all([
        getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.SMALL),
        getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.LARGE)
    ]);
    if (!small || !large) {
        throw new Error("Failed to find thumbnails. Try again later.");
    }

    const { elementId } = elementPath;
    await Promise.all([
        putThumbnail(
            bucket,
            thumbnailKey(elementId, microversionId, ThumbnailSize.SMALL),
            small,
            {
                microversionId,
                canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
            }
        ),
        putThumbnail(
            bucket,
            thumbnailKey(elementId, microversionId, ThumbnailSize.LARGE),
            large,
            {
                microversionId,
                canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
            }
        )
    ]);

    return {
        small: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.SMALL,
            canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
        }),
        large: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.LARGE,
            canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
        })
    };
}

/** Whether every key is already stored, so the render can be skipped. */
async function allStored(bucket: R2Bucket, keys: string[]): Promise<boolean> {
    const heads = await Promise.all(keys.map((key) => bucket.head(key)));
    return heads.every((head) => head !== null);
}

/**
 * Both sizes, so a row and its hover never disagree. The two-stage id flow is the
 * only Onshape path taking a configuration; either call can fail mid-render.
 */
export async function uploadConfigurationThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string,
    canonicalConfiguration: string
): Promise<void> {
    const { elementId } = elementPath;
    const targets = [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) => ({
        size,
        key: thumbnailKey(
            elementId,
            microversionId,
            size,
            canonicalConfiguration
        )
    }));
    const keys = targets.map((target) => target.key);

    // Runs are no longer deduplicated by id, and Onshape is the expensive part.
    if (await allStored(bucket, keys)) {
        return;
    }

    const thumbnailId = await getThumbnailId(
        onshapeApi,
        elementPath,
        canonicalConfiguration
    );
    const rendered = await Promise.all(
        targets.map(async ({ size, key }) => ({
            key,
            thumbnail: await getThumbnailFromId(onshapeApi, thumbnailId, size)
        }))
    );

    // The render above takes minutes, long enough to have been beaten to it.
    if (await allStored(bucket, keys)) {
        return;
    }

    await Promise.all(
        rendered.map(({ key, thumbnail }) =>
            putThumbnail(bucket, key, thumbnail, {
                microversionId,
                canonicalConfiguration
            })
        )
    );
}

/** Falls back to the first element when the document designates no thumbnail. */
export async function uploadDocumentThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    versionPath: InstancePath
): Promise<ThumbnailUrls> {
    const [onshapeDocument, contents] = await Promise.all([
        getDocument(onshapeApi, versionPath),
        getContents(onshapeApi, versionPath)
    ]);

    let thumbnailElementId = onshapeDocument.documentThumbnailElementId;
    if (!thumbnailElementId) {
        if (contents.elements.length < 1)
            throw new Error(
                `Document ${onshapeDocument.name} has no elements to use as a thumbnail.`
            );
        thumbnailElementId = contents.elements[0].id;
    }

    const element = contents.elements.find((e) => e.id === thumbnailElementId);
    if (!element) {
        throw new Error("Unexpectedly failed to find the thumbnail element.");
    }

    const thumbnailPath: ElementPath = {
        ...versionPath,
        elementId: thumbnailElementId
    };
    return uploadThumbnails(
        bucket,
        onshapeApi,
        thumbnailPath,
        element.microversionId
    );
}
