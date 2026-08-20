/**
 * Extracts the insertable tabs from a document's contents listing.
 */
import { ElementType } from "../../../lib/onshape/element-type";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../../../lib/onshape/types";

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/**
 * Tabs in tab-bar order: `elements` is unordered, so the folder tree defines it.
 * Onshape sometimes omits a tab from the tree, so leftovers are appended.
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
