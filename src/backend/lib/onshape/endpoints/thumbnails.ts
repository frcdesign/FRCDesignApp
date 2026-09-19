import { type ConfigurationKey } from "../../../features/configurations/contract";
import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";
import { ThumbnailSize } from "../../../features/thumbnails/contract";

/**
 * `GET /thumbnails/d/{did}/w/{wid}/s/{size}`
 *
 * The whole workspace's thumbnail — what Onshape shows the document as, which
 * it keeps current on its own. Nothing here renders it or waits for one: a
 * workspace either has a thumbnail or does not, unlike a configuration, whose
 * render has to be asked for and waited out.
 */
export function getWorkspaceThumbnail(
    client: OnshapeApi,
    workspacePath: InstancePath,
    size = ThumbnailSize.SMALL
): Promise<ArrayBuffer> {
    assertInstanceType(workspacePath, "w");
    const path =
        apiPath("thumbnails", workspacePath, toInstanceApiPath) + "/s/" + size;
    return client.getImage(path);
}

/**
 * `GET /thumbnails/d/{did}/{wv}/{wvid}/e/{eid}/s/{size}`
 *
 * Returns the thumbnail for a given element in a workspace or version.
 */
export function getElementThumbnail(
    client: OnshapeApi,
    elementPath: ElementPath,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    assertInstanceType(elementPath, "w", "v");
    const path =
        apiPath("thumbnails", elementPath, toElementApiPath) + "/s/" + size;
    return client.getImage(path);
}

/** The configuration matches no insertable, so retrying can only fail again. */
export class NoSuchConfigurationError extends Error {}

export async function getThumbnailId(
    client: OnshapeApi,
    elementPath: ElementPath,
    configurationKey?: ConfigurationKey
): Promise<string> {
    const query = new URLSearchParams({
        includeParts: "true",
        includeAssemblies: "true",
        includeCompositeParts: "true",
        elementId: elementPath.elementId
    });
    if (configurationKey) query.set("configuration", configurationKey);

    const insertables = await client.get(
        apiPath("documents", elementPath, toInstanceApiPath, {
            endRoute: "insertables"
        }),
        { query }
    );
    // A configuration matching nothing comes back with no items at all.
    const thumbnailId = insertables.items?.[0]?.predictableThumbnailId;
    if (!thumbnailId) {
        throw new NoSuchConfigurationError(
            "Onshape returned no insertable for the configuration"
        );
    }
    return thumbnailId;
}

/** Fails repeatedly while Onshape renders the thumbnail in the background. */
export function getThumbnailFromId(
    client: OnshapeApi,
    thumbnailId: string,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    const path =
        apiPath("thumbnails", undefined, undefined, { endId: thumbnailId }) +
        "/s/" +
        size;
    return client.getImage(path);
}
