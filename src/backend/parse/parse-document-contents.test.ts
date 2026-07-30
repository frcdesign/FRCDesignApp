import { describe, expect, it } from "vitest";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeElementGroup,
    type OnshapeFolderEntry,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { parseInsertableTabs } from "./parse-document-contents";

function element(
    id: string,
    elementType = OnshapeElementType.PART_STUDIO
): OnshapeElement {
    return { id, name: `Tab ${id}`, elementType, microversionId: "mv-1" };
}

function ref(elementId: string): OnshapeFolderEntry {
    return { btType: OnshapeFolderEntryType.ELEMENT, elementId };
}

function folder(...entries: OnshapeFolderEntry[]): OnshapeElementGroup {
    return { btType: OnshapeFolderEntryType.GROUP, groups: entries };
}

function contents(
    elements: OnshapeElement[],
    folders: OnshapeElementGroup
): OnshapeDocumentContents {
    return { elements, folders };
}

/** Just the ids, which is all these cases are about. */
function tabIds(document: OnshapeDocumentContents): string[] {
    return parseInsertableTabs(document).map((tab) => tab.id);
}

describe("parseInsertableTabs", () => {
    it("orders tabs by the folder tree, not the element list", () => {
        // `elements` is unordered; `folders` defines the tab bar's order.
        const document = contents(
            [element("c"), element("a"), element("b")],
            folder(ref("a"), ref("b"), ref("c"))
        );
        expect(tabIds(document)).toEqual(["a", "b", "c"]);
    });

    it("flattens nested folders depth-first", () => {
        const document = contents(
            [element("a"), element("b"), element("c"), element("d")],
            folder(ref("a"), folder(ref("b"), folder(ref("c"))), ref("d"))
        );
        expect(tabIds(document)).toEqual(["a", "b", "c", "d"]);
    });

    it("drops element types that aren't insertable", () => {
        const document = contents(
            [
                element("ps", OnshapeElementType.PART_STUDIO),
                element("asm", OnshapeElementType.ASSEMBLY),
                element("dwg", OnshapeElementType.DRAWING),
                element("fs", OnshapeElementType.FEATURE_STUDIO),
                element("blob", OnshapeElementType.BLOB)
            ],
            folder(ref("ps"), ref("asm"), ref("dwg"), ref("fs"), ref("blob"))
        );
        expect(tabIds(document)).toEqual(["ps", "asm"]);
    });

    // Onshape has been known to leave a tab out of the folder tree.
    it("appends tabs missing from the folder tree rather than dropping them", () => {
        const document = contents(
            [element("a"), element("orphan"), element("b")],
            folder(ref("a"), ref("b"))
        );
        expect(tabIds(document)).toEqual(["a", "b", "orphan"]);
    });

    it("ignores tree entries with no matching element", () => {
        const document = contents(
            [element("a")],
            folder(ref("a"), ref("deleted"))
        );
        expect(tabIds(document)).toEqual(["a"]);
    });

    it("returns nothing for a document with no insertable tabs", () => {
        expect(tabIds(contents([], folder()))).toEqual([]);
    });

    it("returns the full element, not just its id", () => {
        const document = contents([element("a")], folder(ref("a")));
        expect(parseInsertableTabs(document)).toEqual([
            {
                id: "a",
                name: "Tab a",
                elementType: OnshapeElementType.PART_STUDIO,
                microversionId: "mv-1"
            }
        ]);
    });
});
