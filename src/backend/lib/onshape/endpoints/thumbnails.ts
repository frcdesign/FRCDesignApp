import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { getInsertables } from "./documents";
import { ThumbnailSize } from "../../../features/thumbnails/contract";

/** The thumbnail Onshape keeps for the whole workspace. */
export function getWorkspaceThumbnail(
    client: OnshapeApi,
    workspacePath: InstancePath,
    size = ThumbnailSize.SMALL
): Promise<ArrayBuffer> {
    assertInstanceType(workspacePath, "w");
    const path = `/thumbnails${toInstanceApiPath(workspacePath)}/s/${size}`;
    return client.getImage(path);
}

/** Returns the thumbnail for a given element in a workspace or version. */
export function getElementThumbnail(
    client: OnshapeApi,
    elementPath: ElementPath,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    assertInstanceType(elementPath, "w", "v");
    const path = `/thumbnails${toElementApiPath(elementPath)}/s/${size}`;
    return client.getImage(path);
}

/**
 * The id Onshape renders a configuration under; asking for its bytes starts
 * the render. Undefined when no part matches the configuration.
 */
export async function getThumbnailId(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<string | undefined> {
    const query: Record<string, string> = {
        includeParts: "true",
        includeAssemblies: "true",
        includeCompositeParts: "true",
        elementId: elementPath.elementId
    };
    const encoded = encodeQueryConfiguration(configuration);
    if (encoded) {
        query.configuration = encoded;
    }

    const insertables = await getInsertables(client, elementPath, query);
    // A configuration matching nothing comes back with no items at all.
    return insertables.items?.[0]?.predictableThumbnailId;
}

/**
 * Answers 404 while Onshape renders, which the first ask starts. Asking for
 * another render meanwhile abandons this one (observed, not documented).
 */
export function getThumbnailFromId(
    client: OnshapeApi,
    thumbnailId: string,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    const path = `/thumbnails/${encodeURIComponent(thumbnailId)}/s/${size}`;
    return client.getImage(path);
}
