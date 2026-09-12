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
 * Stores one size, unless the bucket already holds it. Per size rather than as
 * a pair: an attempt can find one size ready and the other not, and a pair
 * stored only when both calls came back throws away the one that was ready —
 * every attempt, if the sizes keep coming ready in different ones.
 *
 * The key pins the microversion, so a size already stored is what Onshape would
 * render again; skipping it spends none of the account's allocation on bytes we
 * already hold.
 */
async function storeThumbnail(
    bucket: R2Bucket,
    key: string,
    metadata: ThumbnailMetadata,
    render: () => Promise<ArrayBuffer>
): Promise<void> {
    if (await bucket.head(key)) {
        return;
    }
    await putThumbnail(bucket, key, await render(), metadata);
}

/**
 * `allSettled`, so one size failing does not cut the other's store short; the
 * first rejection is rethrown as it came, since the retry curve reads
 * `Retry-After` off an `OnshapeRateLimitError`.
 */
function throwFirstRejection(results: PromiseSettledResult<unknown>[]): void {
    const rejected = results.find(
        (result): result is PromiseRejectedResult =>
            result.status === "rejected"
    );
    if (rejected) {
        throw rejected.reason;
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

    // Both at once: an element reaching here usually needs both, and each is
    // stored as it lands rather than at the end.
    throwFirstRejection(
        await Promise.allSettled(
            BOTH_SIZES.map((size) =>
                storeThumbnail(
                    bucket,
                    thumbnailKey(elementId, microversionId, size),
                    {
                        microversionId,
                        configurationKey: DEFAULT_CONFIGURATION_KEY
                    },
                    () => getElementThumbnail(onshapeApi, elementPath, size)
                )
            )
        )
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
 * Both sizes, so a row and its hover never disagree. Each size is a separate
 * Onshape call and either can fail mid-render, which is what the caller's
 * retries poll out.
 */
export async function uploadConfigurationThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    thumbnailId: string,
    subject: ThumbnailSubject,
    configurationKey: ConfigurationKey
): Promise<void> {
    const { elementId, microversionId } = subject;

    // One size at a time rather than both at once: while the render is still
    // running the first call throws, and the attempt this poll is made of costs
    // one Onshape call instead of two. What an attempt stores, the next skips.
    for (const size of BOTH_SIZES) {
        await storeThumbnail(
            bucket,
            thumbnailKey(elementId, microversionId, size, configurationKey),
            { microversionId, configurationKey },
            () => getThumbnailFromId(onshapeApi, thumbnailId, size)
        );
    }
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
