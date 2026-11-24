/**
 * What pins an element's content, for caching what Onshape answers about it:
 * one pin is always the same content, so a cache keyed by it is never stale.
 */
import { type OnshapeApi } from "./client";
import { getElements } from "./endpoints/documents";
import { type ElementPath } from "./path";

export interface ElementPin {
    /** Undefined where Onshape names no microversion for the element. */
    pin?: string;
    /** Every tab's microversion, by element id; empty outside a workspace. */
    microversions: Map<string, string>;
}

/**
 * A version or microversion pins itself. A workspace tab is pinned by its own
 * microversion, which moves when it or a tab it depends on changes, so an edit
 * to an unrelated tab keeps the pin. One listing of the workspace's tabs.
 */
export async function pinElement(
    client: OnshapeApi,
    path: ElementPath
): Promise<ElementPin> {
    if (path.instanceType !== "w") {
        return {
            pin: `${path.documentId}|${path.instanceType}|${path.instanceId}|${path.elementId}`,
            microversions: new Map()
        };
    }
    const microversions = new Map(
        (await getElements(client, path)).map((element) => [
            element.id,
            element.microversionId
        ])
    );
    const microversion = microversions.get(path.elementId);
    return {
        ...(microversion
            ? { pin: `${path.documentId}|e|${microversion}|${path.elementId}` }
            : {}),
        microversions
    };
}
