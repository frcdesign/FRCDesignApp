import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath, toInstanceApiPath } from "../path";
import { ThumbnailSize } from "../../../features/thumbnails/contract";

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

/** Asking for its bytes starts the render. Undefined when no part matches the configuration. */
export async function getThumbnailId(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<string | undefined> {
    const query = new URLSearchParams({
        includeParts: "true",
        includeAssemblies: "true",
        includeCompositeParts: "true",
        elementId: elementPath.elementId
    });
    // The query form: this is escaped again on its way out.
    const encoded = encodeQueryConfiguration(configuration);
    if (encoded) {
        query.set("configuration", encoded);
    }

    const insertables: {
        items?: { predictableThumbnailId?: string }[];
    } = await client.get(
        `/documents${toInstanceApiPath(elementPath)}/insertables`,
        { query }
    );
    // A configuration matching nothing comes back with no items at all.
    return insertables.items?.[0]?.predictableThumbnailId;
}

/** Fails repeatedly while Onshape renders the thumbnail in the background. */
export function getThumbnailFromId(
    client: OnshapeApi,
    thumbnailId: string,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    const path = `/thumbnails/${encodeURIComponent(thumbnailId)}/s/${size}`;
    return client.getImage(path);
}
