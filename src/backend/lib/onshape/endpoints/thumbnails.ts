import { type ConfigurationKey } from "../../../features/configurations/contract";
import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath, toInstanceApiPath } from "../path";
import { apiPath } from "../api-path";
import { ThumbnailSize } from "../../../features/thumbnails/contract";

/** Returns the thumbnail for a given element in a workspace or version. */
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
