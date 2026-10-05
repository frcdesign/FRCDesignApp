import { ElementType } from "../../lib/onshape/element-type";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeElementGroup,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

/** Whether a tab or folder's name retires it from the library. */
function isDeprecated(name: string | undefined): boolean {
    return name !== undefined && /deprecated/i.test(name);
}

/**
 * The contents as if every deprecated tab, and every tab in a deprecated
 * folder, had been deleted from the document.
 */
export function withoutDeprecated(
    contents: OnshapeDocumentContents
): OnshapeDocumentContents {
    const retired = new Set<string>();
    const prune = (group: OnshapeElementGroup): OnshapeElementGroup => ({
        ...group,
        groups: group.groups.flatMap((entry): OnshapeFolderEntry[] => {
            if (entry.btType !== OnshapeFolderEntryType.GROUP) {
                return [entry];
            }
            if (isDeprecated(entry.groupName)) {
                for (const elementId of traverseFolders(entry.groups)) {
                    retired.add(elementId);
                }
                return [];
            }
            return [prune(entry)];
        })
    });

    const folders = prune(contents.folders);
    return {
        folders,
        elements: contents.elements.filter(
            (element) => !retired.has(element.id) && !isDeprecated(element.name)
        )
    };
}

/** In tab-bar order, from the folder tree; tabs Onshape omits from the tree are appended. */
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
