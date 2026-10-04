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
 * Onshape's own name for a configuration's render: base32 of a FeatureScript
 * map, which only insertables spells. Undefined when no part matches.
 */
export async function getEncodedConfiguration(
    client: OnshapeApi,
    workspacePath: ElementPath,
    configuration: Selection
): Promise<string | undefined> {
    assertInstanceType(workspacePath, "w");
    const query: Record<string, string> = {
        includeParts: "true",
        includeAssemblies: "true",
        includeCompositeParts: "true",
        elementId: workspacePath.elementId
    };
    const encoded = encodeQueryConfiguration(configuration);
    if (encoded) {
        query.configuration = encoded;
    }

    const insertables = await getInsertables(client, workspacePath, query);
    // A configuration matching nothing comes back with no items at all.
    if (!insertables.items?.length) {
        return undefined;
    }
    if (!insertables.configurationKey) {
        throw new Error("Onshape named no configuration key to render.");
    }
    return insertables.configurationKey;
}

/**
 * What Onshape's own insert dialog polls: 404 until the configuration is
 * rendered, which asking starts.
 */
export function getConfiguredThumbnail(
    client: OnshapeApi,
    workspacePath: ElementPath,
    encodedConfiguration: string,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    assertInstanceType(workspacePath, "w");
    const path = `/thumbnails${toElementApiPath(workspacePath)}/c/${encodedConfiguration}/s/${size}`;
    return client.getImage(path);
}
