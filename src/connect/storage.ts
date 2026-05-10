import { getStorage } from "firebase-admin/storage";
import { OAuthClient } from "../onshape-api/client/oauth-client";
import { getElementThumbnail, ThumbnailSize } from "../onshape-api/endpoints/thumbnails";
import { ElementPath, InstancePath } from "../onshape-api/path";

const BUCKET_NAME = "frc-design-app-data";
/** 30-day CDN cache for thumbnail blobs. */
const CACHE_CONTROL = `public, max-age=${30 * 24 * 3600}, immutable`;

function getBucket() {
    return getStorage().bucket(BUCKET_NAME);
}

function publicUrl(blobPath: string, microversionId: string): string {
    return `https://storage.googleapis.com/${BUCKET_NAME}/${blobPath}?v=${microversionId}`;
}

async function isCurrentVersion(blobPath: string, microversionId: string): Promise<boolean> {
    const file = getBucket().file(blobPath);
    const [exists] = await file.exists();
    if (!exists) return false;
    const [metadata] = await file.getMetadata();
    return (metadata as any).metadata?.microversionId === microversionId;
}

/**
 * Uploads thumbnails for an element to Firebase Storage for the given sizes,
 * skipping any that are already current. Returns a map of size → public URL.
 */
export async function uploadThumbnails(
    client: OAuthClient,
    elementPath: ElementPath,
    microversionId: string,
    sizes: ThumbnailSize[] = [ThumbnailSize.TINY, ThumbnailSize.STANDARD]
): Promise<Partial<Record<ThumbnailSize, string>>> {
    const bucket = getBucket();
    const urls: Partial<Record<ThumbnailSize, string>> = {};

    await Promise.all(
        sizes.map(async (size) => {
            const blobPath = `thumbnails/${size}/${elementPath.elementId}`;

            if (await isCurrentVersion(blobPath, microversionId)) {
                urls[size] = publicUrl(blobPath, microversionId);
                return;
            }

            let thumbnail: ArrayBuffer;
            try {
                thumbnail = await getElementThumbnail(client, elementPath, size);
            } catch {
                return;
            }

            await bucket.file(blobPath).save(Buffer.from(thumbnail), {
                contentType: "image/gif",
                metadata: {
                    cacheControl: CACHE_CONTROL,
                    metadata: { microversionId }
                }
            });

            urls[size] = publicUrl(blobPath, microversionId);
        })
    );

    return urls;
}

/**
 * Uploads thumbnails for a document using the document's designated thumbnail element.
 * Falls back to the first element if `documentThumbnailElementId` is empty.
 */
export async function uploadDocumentThumbnails(
    client: OAuthClient,
    onshapeDocument: any,
    contents: any,
    versionPath: InstancePath
): Promise<Partial<Record<ThumbnailSize, string>>> {
    let thumbnailElementId: string = onshapeDocument.documentThumbnailElementId;
    if (!thumbnailElementId) {
        const elements: any[] = contents.elements;
        if (elements.length < 1)
            throw new Error(`Document ${onshapeDocument.name} has no elements to use as a thumbnail.`);
        thumbnailElementId = elements[0].id;
    }

    const element = (contents.elements as any[]).find((e) => e.id === thumbnailElementId);
    if (!element) throw new Error("Unexpectedly failed to find the thumbnail element.");

    const thumbnailPath: ElementPath = { ...versionPath, elementId: thumbnailElementId };
    return uploadThumbnails(client, thumbnailPath, element.microversionId);
}
