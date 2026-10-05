import { describe, expect, it } from "vitest";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    type OnshapeElementGroup,
    type OnshapeFolderEntry,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import {
    parseInsertableTabs,
    withoutDeprecated
} from "./parse-document-contents";

function element(
    id: string,
    elementType = OnshapeElementType.PART_STUDIO,
    name = `Tab ${id}`
): OnshapeElement {
    return { id, name, elementType, microversionId: "mv-1" };
}

function ref(elementId: string): OnshapeFolderEntry {
    return { btType: OnshapeFolderEntryType.ELEMENT, elementId };
}

function folder(...entries: OnshapeFolderEntry[]): OnshapeElementGroup {
    return { btType: OnshapeFolderEntryType.GROUP, groups: entries };
}

function named(
    groupName: string,
    ...entries: OnshapeFolderEntry[]
): OnshapeElementGroup {
    return { ...folder(...entries), groupName };
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
});

describe("withoutDeprecated", () => {
    const deprecatedTabs = () =>
        tabIds(
            withoutDeprecated(
                contents(
                    [
                        element("a"),
                        element(
                            "old",
                            OnshapeElementType.PART_STUDIO,
                            "Gearbox (DEPRECATED)"
                        ),
                        element("b")
                    ],
                    folder(ref("a"), ref("old"), ref("b"))
                )
            )
        );

    it("drops a tab whose name says it is deprecated, in any case", () => {
        expect(deprecatedTabs()).toEqual(["a", "b"]);
    });

    it("drops every tab in a deprecated folder, however deep", () => {
        const document = withoutDeprecated(
            contents(
                [element("a"), element("b"), element("c"), element("d")],
                folder(
                    ref("a"),
                    named("Deprecated parts", ref("b"), named("Old", ref("c"))),
                    ref("d")
                )
            )
        );
        expect(tabIds(document)).toEqual(["a", "d"]);
        expect(document.elements.map((each) => each.id)).toEqual(["a", "d"]);
    });

    it("keeps the tabs of a folder whose name doesn't say so", () => {
        const document = withoutDeprecated(
            contents(
                [element("a"), element("b")],
                folder(named("Gearboxes", ref("a")), ref("b"))
            )
        );
        expect(tabIds(document)).toEqual(["a", "b"]);
    });
});
