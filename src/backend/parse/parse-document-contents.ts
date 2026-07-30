/**
 * Extracts the insertable tabs from a document's contents listing.
 */
import { ElementType } from "../../shared/types";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/**
 * The part studio / assembly tabs we load, in the order they appear in the
 * document's tab bar.
 *
 * `contents.elements` is unordered, and `contents.folders` is the folder tree
 * that defines display order — so walk the tree and pick up each tab as it is
 * encountered. Onshape has been known to omit a tab from the tree, so anything
 * left over is appended rather than dropped.
 */
export function parseInsertableTabs(
    contents: OnshapeDocumentContents
): OnshapeElement[] {
    const remaining = new Map(
        contents.elements
            .filter((element) => VALID_ELEMENT_TYPES.has(element.elementType))
            .map((element) => [element.id, element])
    );

    const tabs: OnshapeElement[] = [];
    for (const elementId of traverseFolders(contents.folders.groups)) {
        const tab = remaining.get(elementId);
        if (tab) {
            tabs.push(tab);
            remaining.delete(elementId);
        }
    }
    return [...tabs, ...remaining.values()];
}

/** Yields each elementId in a folder tree, depth-first, in display order. */
function* traverseFolders(entries: OnshapeFolderEntry[]): Generator<string> {
    for (const entry of entries) {
        if (entry.btType === OnshapeFolderEntryType.GROUP) {
            yield* traverseFolders(entry.groups);
        } else if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
            yield entry.elementId;
        }
    }
}
