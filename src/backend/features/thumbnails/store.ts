/**
 * Renders thumbnails through Onshape and stores them in R2. Kept out of the
 * routes so the load workflows can reach it without importing the app.
 */

import { CachePolicy, immutableCacheControl } from "../../lib/cache";

import {
    getElementThumbnail,
    getThumbnailFromId
} from "../../lib/onshape/endpoints/thumbnails";
import {
    getDocument,
    getContents
} from "../../lib/onshape/endpoints/documents";
import { type ElementPath, type InstancePath } from "../../lib/onshape/path";

import { ThumbnailSize, ThumbnailUrls } from "./contract";
import { thumbnailKey, thumbnailUrl, type ThumbnailSubject } from "./keys";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/contract";
import { OnshapeApi } from "../../lib/onshape/client";

/**
 * What produced a stored thumbnail, tagged onto the R2 object. The key already
 * addresses it; this is for reading an object back and telling what it is.
 */
interface ThumbnailMetadata extends Record<string, string> {
    microversionId: string;
    /** Empty for an element's own thumbnail, as everywhere else. */
    configurationKey: ConfigurationKey;
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

const BOTH_SIZES = [ThumbnailSize.SMALL, ThumbnailSize.LARGE];

/**
 * Renders and stores both sizes, skipping either the bucket already holds.
 *
 * Checked and stored per size, because an attempt can find one size rendered
 * and the other not: a pair stored only once both calls came back throws away
 * the one that was ready, every attempt, if the sizes keep coming ready in
 * different ones. The key pins the microversion, so a size already stored is
 * what Onshape would render again.
 *
 * One call at a time, so an attempt against a render that is not ready costs
 * one Onshape call rather than two. Asking for both at once also drew
 * intermittent 406s, which as far as I know nobody has explained.
 */
async function storeBothSizes(
    bucket: R2Bucket,
    keyOf: (size: ThumbnailSize) => string,
    metadata: ThumbnailMetadata,
    render: (size: ThumbnailSize) => Promise<ArrayBuffer>
): Promise<void> {
    for (const size of BOTH_SIZES) {
        const key = keyOf(size);
        if (await bucket.head(key)) {
            continue;
        }
        await putThumbnail(bucket, key, await render(size), metadata);
    }
}

/** Throws until Onshape has rendered them, which drives the load step's retries. */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const { elementId } = elementPath;

    await storeBothSizes(
        bucket,
        (size) => thumbnailKey(elementId, microversionId, size),
        { microversionId, configurationKey: DEFAULT_CONFIGURATION_KEY },
        (size) => getElementThumbnail(onshapeApi, elementPath, size)
    );

    return {
        small: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.SMALL,
            configurationKey: DEFAULT_CONFIGURATION_KEY
        }),
        large: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.LARGE,
            configurationKey: DEFAULT_CONFIGURATION_KEY
        })
    };
}

/**
 * Both sizes, so a row and its hover never disagree. Either size can fail
 * mid-render, which is what the caller's retries poll out.
 */
export async function uploadConfigurationThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    thumbnailId: string,
    subject: ThumbnailSubject,
    configurationKey: ConfigurationKey
): Promise<void> {
    const { elementId, microversionId } = subject;

    await storeBothSizes(
        bucket,
        (size) =>
            thumbnailKey(elementId, microversionId, size, configurationKey),
        { microversionId, configurationKey },
        (size) => getThumbnailFromId(onshapeApi, thumbnailId, size)
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
