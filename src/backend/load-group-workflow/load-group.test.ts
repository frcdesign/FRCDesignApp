import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/types";
import {
    OnshapeDocumentContents,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import {
    getOrderedElementIds,
    getValidElements,
    matchElements,
    getInsertablesToReload,
    type DocumentElement,
    type DocumentInfo,
    type MatchedElement
} from "./load-group";

const element = (
    elementId: string,
    microversionId = "mv-1"
): DocumentElement => ({
    elementId,
    name: elementId,
    elementType: ElementType.PART_STUDIO,
    microversionId
});

const matchedOf = (
    el: DocumentElement,
    overrides: Partial<MatchedElement> = {}
): MatchedElement => ({
    element: el,
    insertableId: `id-${el.elementId}`,
    isNew: false,
    storedMicroversionId: el.microversionId,
    supportsFasten: false,
    hasConfiguration: false,
    sortOrder: 0,
    ...overrides
});

// --- pure: contents tree ----------------------------------------------------

describe("getValidElements / getOrderedElementIds", () => {
    const contents: OnshapeDocumentContents = {
        elements: [
            {
                id: "ps",
                name: "Part Studio",
                elementType: OnshapeElementType.PART_STUDIO,
                microversionId: "m1"
            },
            {
                id: "asm",
                name: "Assembly",
                elementType: OnshapeElementType.ASSEMBLY,
                microversionId: "m2"
            },
            {
                id: "dwg",
                name: "Drawing",
                elementType: OnshapeElementType.DRAWING,
                microversionId: "m3"
            }
        ],
        folders: {
            btType: OnshapeFolderEntryType.GROUP,
            groups: [
                { btType: OnshapeFolderEntryType.ELEMENT, elementId: "asm" },
                {
                    btType: OnshapeFolderEntryType.GROUP,
                    groups: [
                        {
                            btType: OnshapeFolderEntryType.ELEMENT,
                            elementId: "dwg"
                        },
                        {
                            btType: OnshapeFolderEntryType.ELEMENT,
                            elementId: "ps"
                        }
                    ]
                }
            ]
        }
    };

    it("keeps only part studios and assemblies", () => {
        expect(getValidElements(contents)).toEqual([
            {
                elementId: "ps",
                name: "Part Studio",
                elementType: ElementType.PART_STUDIO,
                microversionId: "m1"
            },
            {
                elementId: "asm",
                name: "Assembly",
                elementType: ElementType.ASSEMBLY,
                microversionId: "m2"
            }
        ]);
    });

    it("flattens the folder tree in order", () => {
        expect(getOrderedElementIds(contents)).toEqual(["asm", "dwg", "ps"]);
    });
});

// --- pure: match + select ---------------------------------------------------

describe("matchElements", () => {
    const docInfo: DocumentInfo = {
        docName: "Doc",
        elements: [element("e1", "mv-new"), element("e2")],
        orderedElementIds: ["e2", "e1"]
    };

    it("reuses existing rows and assigns ids + defaults to new elements", () => {
        const matched = matchElements(
            docInfo,
            [
                {
                    elementId: "e1",
                    insertableId: "keep-1",
                    microversionId: "mv-old",
                    supportsFasten: true,
                    hasConfiguration: true
                }
            ],
            () => "fresh-uuid"
        );

        expect(matched).toEqual([
            {
                element: docInfo.elements[0],
                insertableId: "keep-1",
                isNew: false,
                storedMicroversionId: "mv-old",
                supportsFasten: true,
                hasConfiguration: true,
                sortOrder: 1
            },
            {
                element: docInfo.elements[1],
                insertableId: "fresh-uuid",
                isNew: true,
                storedMicroversionId: null,
                supportsFasten: false,
                hasConfiguration: false,
                sortOrder: 0
            }
        ]);
    });
});

describe("selectReloads", () => {
    const e = element("e1", "mv-cur");
    const unchanged = matchedOf(e, { storedMicroversionId: "mv-cur" });
    const changed = matchedOf(e, { storedMicroversionId: "mv-old" });
    const fresh = matchedOf(e, { isNew: true, storedMicroversionId: null });

    it("reloads new, changed, or forced elements only", () => {
        expect(
            getInsertablesToReload([unchanged, changed, fresh], false)
        ).toEqual([changed, fresh]);
    });

    it("reloads everything when forced", () => {
        expect(
            getInsertablesToReload([unchanged, changed, fresh], true)
        ).toHaveLength(3);
    });
});
