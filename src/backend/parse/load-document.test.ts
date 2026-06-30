import { describe, expect, it } from "vitest";
import { getOrderedElementIds, getValidElements } from "./load-document";
import {
    OnshapeDocumentContents,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../onshape-api/types/documents";
import { ElementType } from "../../shared/types";

describe("getValidElements", () => {
    it("keeps only part studios and assemblies, mapping persisted fields", () => {
        const contents: OnshapeDocumentContents = {
            folders: { btType: OnshapeFolderEntryType.GROUP, groups: [] },
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
                },
                {
                    id: "blob",
                    name: "Blob",
                    elementType: OnshapeElementType.BLOB,
                    microversionId: "m4"
                }
            ]
        };

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
});

describe("getOrderedElementIds", () => {
    it("flattens the folder tree in order, descending into nested groups", () => {
        const contents: OnshapeDocumentContents = {
            elements: [],
            folders: {
                btType: OnshapeFolderEntryType.GROUP,
                groups: [
                    { btType: OnshapeFolderEntryType.ELEMENT, elementId: "e1" },
                    {
                        btType: OnshapeFolderEntryType.GROUP,
                        groups: [
                            {
                                btType: OnshapeFolderEntryType.ELEMENT,
                                elementId: "e2"
                            },
                            {
                                btType: OnshapeFolderEntryType.ELEMENT,
                                elementId: "e3"
                            }
                        ]
                    },
                    { btType: OnshapeFolderEntryType.ELEMENT, elementId: "e4" }
                ]
            }
        };

        expect(getOrderedElementIds(contents)).toEqual([
            "e1",
            "e2",
            "e3",
            "e4"
        ]);
    });
});
