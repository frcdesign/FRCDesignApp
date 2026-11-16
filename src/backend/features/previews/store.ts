/** Preview meshes in R2, by element, version and configuration: a hit is never stale. */
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/contract";
import { type ThumbnailSubject } from "../thumbnails/keys";
import { PREVIEW_MESH_CONTENT_TYPE } from "./contract";

export const PREVIEW_PREFIX = "previews/";

const DEFAULT_SEGMENT = "default";

/** The configuration is url-encoded to keep `/` and `;` out of the path. */
export function previewKey(
    elementId: string,
    microversionId: string,
    configurationKey: ConfigurationKey
): string {
    const configuration =
        configurationKey === DEFAULT_CONFIGURATION_KEY
            ? DEFAULT_SEGMENT
            : encodeURIComponent(configurationKey);
    return `${PREVIEW_PREFIX}${elementId}/${microversionId}/${configuration}`;
}

/** Undefined for a key it didn't write, which cleanup then leaves alone. */
export function parsePreviewKey(key: string): ThumbnailSubject | undefined {
    if (!key.startsWith(PREVIEW_PREFIX)) {
        return undefined;
    }
    const [elementId, microversionId, configuration, ...rest] = key
        .slice(PREVIEW_PREFIX.length)
        .split("/");
    return elementId && microversionId && configuration && rest.length === 0
        ? { elementId, microversionId }
        : undefined;
}

export async function getStoredPreview(
    bucket: R2Bucket,
    key: string
): Promise<ArrayBuffer | undefined> {
    const object = await bucket.get(key);
    return object ? await object.arrayBuffer() : undefined;
}

export async function putStoredPreview(
    bucket: R2Bucket,
    key: string,
    mesh: ArrayBuffer
): Promise<void> {
    await bucket.put(key, mesh, {
        httpMetadata: { contentType: PREVIEW_MESH_CONTENT_TYPE }
    });
}
