import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";
import { TEST_LIBRARY_ID } from "../../__test_utils__";
import {
    toInsertableUpdate,
    toNewInsertableRow,
    type LoadInsertableData
} from "./load-insertable";

describe("toNewInsertableRow / toInsertableUpdate", () => {
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
    const loaded = {
        parameters: null,
        vendors: [],
        thumbnailUrls: null,
        fastenInfo: null
    };

    it("toNewInsertableRow includes id/ownership fields + sortOrder and flags build issues", () => {
        const row = toNewInsertableRow(data, loaded);
        expect(row).toMatchObject({
            id: "i1",
            elementId: "e1",
            groupId: "g1",
            documentId: "doc",
            libraryId: TEST_LIBRARY_ID,
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

    it("toInsertableUpdate omits id/ownership fields and sortOrder", () => {
        const update = toInsertableUpdate(data, loaded);
        expect(update).not.toHaveProperty("id");
        expect(update).not.toHaveProperty("elementId");
        expect(update).not.toHaveProperty("groupId");
        expect(update).not.toHaveProperty("documentId");
        expect(update).not.toHaveProperty("libraryId");
        expect(update).not.toHaveProperty("sortOrder");
        expect(update).toMatchObject({
            versionId: "v1",
            vendors: [],
            thumbnailUrls: null
        });
        expect(update.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED },
            { type: BuildIssueType.NO_VENDORS }
        ]);
    });
});
