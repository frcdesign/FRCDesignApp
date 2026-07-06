import { env } from "cloudflare:workers";
import { describe, expect, it, beforeEach } from "vitest";
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
    type MatchedInsertable
} from "./load-group";
import { getDb } from "../db";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup
} from "../../__test_utils__";
import { insertables } from "../../shared/schema";

const db = getDb(env.DB);

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
    overrides: Partial<MatchedInsertable> = {}
): MatchedInsertable => ({
    element: el,
    insertableId: `id-${el.elementId}`,
    isNew: false,
    storedMicroversionId: el.microversionId,
    supportsFasten: false,
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

// --- match + select ----------------------------------------------------------

describe("matchElements", () => {
    beforeEach(() => resetDb(db));

    const docInfo: DocumentInfo = {
        docName: "Doc",
        versionId: "v-new",
        elements: [element("e1", "mv-new"), element("e2")],
        orderedElementIds: ["e2", "e1"]
    };

    it("reuses existing rows (selected by groupId/libraryId/elementId) and assigns ids + defaults to new elements", async () => {
        await seedGroup(db, TEST_GROUP_ID, TEST_LIBRARY_ID);
        await db.insert(insertables).values({
            id: "keep-1",
            groupId: TEST_GROUP_ID,
            libraryId: TEST_LIBRARY_ID,
            elementId: "e1",
            documentId: "doc",
            versionId: "v-old",
            elementType: ElementType.PART_STUDIO,
            name: "e1",
            microversionId: "mv-old",
            supportsFasten: true
        });

        const matched = await matchElements(
            db,
            TEST_GROUP_ID,
            TEST_LIBRARY_ID,
            docInfo,
            () => "fresh-uuid"
        );

        expect(matched).toEqual([
            {
                element: docInfo.elements[0],
                insertableId: "keep-1",
                isNew: false,
                storedMicroversionId: "mv-old",
                supportsFasten: true,
                sortOrder: 1
            },
            {
                element: docInfo.elements[1],
                insertableId: "fresh-uuid",
                isNew: true,
                storedMicroversionId: null,
                supportsFasten: false,
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
