import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath, toInstanceApiPath } from "../path";
import { ThumbnailSize } from "../../../features/thumbnails/contract";

/**
 * Without these Onshape answers a thumbnail it hasn't rendered with a stand-in
 * image, which would be stored as if it were the real one.
 */
const RENDERED_ONLY = { skipDefaultImage: "true", rejectEmpty: "true" };

/** An element's own thumbnail; fails until Onshape has rendered it. */
export function getElementThumbnail(
    client: OnshapeApi,
    elementPath: ElementPath,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    assertInstanceType(elementPath, "w", "v");
    const path = `/thumbnails${toElementApiPath(elementPath)}/s/${size}`;
    return client.getImage(path, { query: RENDERED_ONLY });
}

/**
 * A configuration's thumbnail, which Onshape only serves from a workspace.
 * Fails until that configuration is rendered, rather than answering with
 * another configuration's.
 */
export function getConfiguredThumbnail(
    client: OnshapeApi,
    workspacePath: ElementPath,
    configuration: Selection,
    size = ThumbnailSize.LARGE
): Promise<ArrayBuffer> {
    assertInstanceType(workspacePath, "w");
    const encoded = encodeURIComponent(encodeQueryConfiguration(configuration));
    const path = `/thumbnails${toElementApiPath(workspacePath)}/ac/${encoded}/s/${size}`;
    return client.getImage(path, {
        query: { ...RENDERED_ONLY, requireConfigMatch: "true" }
    });
}

/** Whether the configuration regenerates into anything to insert. */
export async function hasInsertable(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<boolean> {
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

    const insertables: { items?: unknown[] } = await client.get(
        `/documents${toInstanceApiPath(elementPath)}/insertables`,
        { query }
    );
    // A configuration matching nothing comes back with no items at all.
    return (insertables.items?.length ?? 0) > 0;
}
