import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";
import { TEST_LIBRARY_ID } from "../../__test_utils__";
import { toInsertableRow, type LoadInsertableData } from "./load-insertable";

describe("toInsertableRow", () => {
    const data: LoadInsertableData = {
        insertableId: "i1",
        groupId: "g1",
        documentId: "doc",
        libraryId: TEST_LIBRARY_ID,
        versionId: "v1",
        elementPath: {
            documentId: "doc",
            instanceId: "v1",
            instanceType: "v",
            elementId: "e1"
        },
        name: "e1",
        elementType: ElementType.PART_STUDIO,
        microversionId: "mv-1",
        sortOrder: 3,
        isNew: false,
        supportsFasten: false
    };

    it("maps the insertable id/sortOrder + versionId and flags build issues", () => {
        const row = toInsertableRow(data, {
            parameters: null,
            vendors: [],
            thumbnailUrls: null,
            fastenInfo: null
        });
        expect(row).toMatchObject({
            id: "i1",
            elementId: "e1",
            groupId: "g1",
            sortOrder: 3,
            versionId: "v1",
            vendors: [],
            thumbnailUrls: null
        });
        // No vendors and no thumbnail → both issues flagged.
        expect(row.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED },
            { type: BuildIssueType.NO_VENDORS }
        ]);
    });
});
