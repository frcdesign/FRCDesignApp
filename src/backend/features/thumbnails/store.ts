/**
 * Where thumbnails live in R2, and how a caller reads one back. Only
 * `ThumbnailRenderer` asks Onshape for one; this is the storage either side.
 */

import { CachePolicy, immutableCacheControl } from "../../lib/cache";

import {
    getDocument,
    getContents
} from "../../lib/onshape/endpoints/documents";
import { type ElementPath, type InstancePath } from "../../lib/onshape/path";

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

/** The element whose thumbnail stands for a whole document, and its microversion. */
export interface DocumentThumbnailElement {
    elementPath: ElementPath;
    microversionId: string;
}

/**
 * Which element a group's thumbnail comes from, falling back to the first when
 * the document designates none.
 */
export async function resolveDocumentThumbnail(
    onshapeApi: OnshapeApi,
    versionPath: InstancePath
): Promise<DocumentThumbnailElement> {
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

    return {
        elementPath: { ...versionPath, elementId: thumbnailElementId },
        microversionId: element.microversionId
    };
}
