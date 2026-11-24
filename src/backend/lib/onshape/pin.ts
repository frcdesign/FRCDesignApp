/**
 * What pins an element's content, for caching what Onshape answers about it:
 * one pin is always the same content, so a cache keyed by it is never stale.
 */
import { type OnshapeApi } from "./client";
import { getCurrentMicroversion } from "./endpoints/documents";
import { type ElementPath } from "./path";

/**
 * A version or microversion pins itself. A workspace is pinned by the
 * microversion it is at, which any edit to any of its tabs moves, so it covers
 * what the element references in the document as well as the element itself.
 * Undefined where Onshape names none.
 */
export async function pinElement(
    client: OnshapeApi,
    path: ElementPath
): Promise<string | undefined> {
    if (path.instanceType !== "w") {
        return `${path.documentId}|${path.instanceType}|${path.instanceId}|${path.elementId}`;
    }
    const { microversion } = await getCurrentMicroversion(client, path);
    return microversion
        ? `${path.documentId}|m|${microversion}|${path.elementId}`
        : undefined;
}
