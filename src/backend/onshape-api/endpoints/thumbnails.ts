import { OnshapeApi } from "../onshape-api";
import { assertInstanceType, assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../../../shared/path";
import { apiPath } from "../api-path";

/** Represents the possible sizes of a thumbnail. */
export enum ThumbnailSize {
    STANDARD = "300x300",
    LARGE = "600x340",
    SMALL = "300x170",
    TINY = "70x40"
}

/** Returns the thumbnail of a given document instance. */
export function getInstanceThumbnail(
    client: OnshapeApi,
    instancePath: InstancePath,
    size = ThumbnailSize.STANDARD
): Promise<ArrayBuffer> {
    assertInstanceType(instancePath, "w", "v");
    const path =
        apiPath("thumbnails", instancePath, toInstanceApiPath) + "/s/" + size;
    return client.getImage(path);
}

/** Returns the thumbnail for a given element in a workspace or version. */
export function getElementThumbnail(
    client: OnshapeApi,
    elementPath: ElementPath,
    size = ThumbnailSize.STANDARD
): Promise<ArrayBuffer> {
    assertInstanceType(elementPath, "w", "v");
    const path =
        apiPath("thumbnails", elementPath, toElementApiPath) + "/s/" + size;
    return client.getImage(path);
}

/**
 * Returns the thumbnail of a given element in a workspace, optionally with a specific configuration.
 *
 * Compared to `getElementThumbnail`, this endpoint supports configurations but is limited to workspaces only.
 */
export function getThumbnailFromWorkspace(
    client: OnshapeApi,
    elementPath: ElementPath,
    size = ThumbnailSize.STANDARD,
    configuration?: string
): Promise<ArrayBuffer> {
    assertWorkspace(elementPath);
    let path = apiPath("thumbnails", elementPath, toElementApiPath);
    if (configuration) path += "/ac/" + configuration;
    path += "/s/" + size;
    return client.getImage(path, {
        query: { rejectEmpty: "true", requireConfigMatch: "true" }
    });
}

export async function getThumbnailId(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration?: string
): Promise<string> {
    const query = new URLSearchParams({
        includeParts: "true",
        includeAssemblies: "true",
        includeCompositeParts: "true",
        elementId: elementPath.elementId
    });
    if (configuration) query.set("configuration", configuration);

    const insertables = await client.get(
        apiPath("documents", elementPath, toInstanceApiPath, {
            endRoute: "insertables"
        }),
        { query }
    );
    return insertables.items[0].predictableThumbnailId;
}

/**
 * Returns the thumbnail for a given thumbnail ID.
 *
 * WARNING: This endpoint is very buggy and can fail repeatedly while Onshape generates the thumbnail in the background.
 */
export function getThumbnailFromId(
    client: OnshapeApi,
    thumbnailId: string,
    size = ThumbnailSize.STANDARD
): Promise<ArrayBuffer> {
    const path =
        apiPath("thumbnails", undefined, undefined, { endId: thumbnailId }) +
        "/s/" +
        size;
    return client.getImage(path);
}
