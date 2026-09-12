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

/** Whether every key is already stored, so the render can be skipped. */
async function allStored(bucket: R2Bucket, keys: string[]): Promise<boolean> {
    const heads = await Promise.all(keys.map((key) => bucket.head(key)));
    return heads.every((head) => head !== null);
}

/** Throws until Onshape has rendered them, which drives the load step's retries. */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const { elementId } = elementPath;
    const keys = [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) =>
        thumbnailKey(elementId, microversionId, size)
    );

    // The key pins the microversion, so what is stored under it is what Onshape
    // would render again. A forced reload reaches here with the microversion
    // unchanged, and downloading both sizes again would spend the account's
    // Onshape allocation on bytes we already hold.
    if (!(await allStored(bucket, keys))) {
        const [small, large] = await Promise.all([
            getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.SMALL),
            getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.LARGE)
        ]);
        if (!small || !large) {
            throw new Error("Failed to find thumbnails. Try again later.");
        }
        await Promise.all(
            [small, large].map((thumbnail, index) =>
                putThumbnail(bucket, keys[index], thumbnail, {
                    microversionId,
                    configurationKey: DEFAULT_CONFIGURATION_KEY
                })
            )
        );
    }

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
    const targets = [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) => ({
        size,
        key: thumbnailKey(elementId, microversionId, size, configurationKey)
    }));
    const keys = targets.map((target) => target.key);

    // A restarted run replays this step, and Onshape is the expensive part.
    if (await allStored(bucket, keys)) {
        return;
    }

    // One size at a time rather than both at once: while the render is still
    // running the first call throws, and the attempt this poll is made of costs
    // one Onshape call instead of two.
    const rendered: { key: string; thumbnail: ArrayBuffer }[] = [];
    for (const { size, key } of targets) {
        rendered.push({
            key,
            thumbnail: await getThumbnailFromId(onshapeApi, thumbnailId, size)
        });
    }

    // The render above takes minutes, long enough to have been beaten to it.
    if (await allStored(bucket, keys)) {
        return;
    }

    await Promise.all(
        rendered.map(({ key, thumbnail }) =>
            putThumbnail(bucket, key, thumbnail, {
                microversionId,
                configurationKey
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
