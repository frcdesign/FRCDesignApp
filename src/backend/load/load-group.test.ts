import { describe, expect, it } from "vitest";
import {
    type OnshapeElement,
    OnshapeElementType
} from "../onshape-api/onshape-types";
import {
    type StoredInsertable,
    findRemovedInsertables,
    selectInsertablesToLoad
} from "./load-group";
import type { GroupTarget } from "./load-utils";
import { TEST_LIBRARY_ID } from "../../__test_utils__";

const GROUP: GroupTarget = {
    libraryId: TEST_LIBRARY_ID,
    groupId: "group-1",
    versionPath: {
        documentId: "doc-1",
        instanceId: "v-1",
        instanceType: "v"
    }
};

/** Runs the selection against the shared test group. */
function select(
    insertableTabs: OnshapeElement[],
    stored: StoredInsertable[],
    forceReload: boolean
) {
    return selectInsertablesToLoad(GROUP, insertableTabs, stored, forceReload);
}

function tab(elementId: string, microversionId = "mv-1"): OnshapeElement {
    return {
        id: elementId,
        name: `Tab ${elementId}`,
        elementType: OnshapeElementType.PART_STUDIO,
        microversionId
    };
}

function storedRow(
    elementId: string,
    overrides: Partial<StoredInsertable> = {}
): StoredInsertable {
    return {
        id: `row-${elementId}`,
        elementId,
        microversionId: "mv-1",
        ...overrides
    };
}

describe("selectInsertablesToLoad", () => {
    it("mints an id for a brand-new element and loads it", () => {
        const toLoad = select([tab("e1")], [], false);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0].elementPath.elementId).toBe("e1");
        expect(toLoad[0].insertableId).toEqual(expect.any(String));
    });

    it("stamps the group and version path onto each insertable", () => {
        const toLoad = select([tab("e1")], [], false);
        expect(toLoad[0]).toMatchObject({
            libraryId: GROUP.libraryId,
            groupId: GROUP.groupId,
            elementPath: {
                documentId: "doc-1",
                instanceId: "v-1",
                instanceType: "v",
                elementId: "e1"
            }
        });
    });

    it("leaves an unchanged element alone", () => {
        const toLoad = select([tab("e1")], [storedRow("e1")], false);
        expect(toLoad).toEqual([]);
    });

    it("reloads an element whose microversion changed, keeping its id", () => {
        const toLoad = select([tab("e1", "mv-2")], [storedRow("e1")], false);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0]).toMatchObject({
            insertableId: "row-e1",
            microversionId: "mv-2"
        });
    });

    it("reloads unchanged elements on forceReload", () => {
        const toLoad = select([tab("e1")], [storedRow("e1")], true);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0].insertableId).toBe("row-e1");
    });

    it("ignores a removed row rather than loading it", () => {
        const toLoad = select(
            [tab("e1")],
            [storedRow("e1"), storedRow("gone")],
            false
        );
        expect(
            toLoad.map((insertable) => insertable.elementPath.elementId)
        ).toEqual([]);
    });

    it("seeds sortOrder from the tab position", () => {
        const toLoad = select([tab("e1"), tab("e2")], [], false);
        expect(
            toLoad.map((insertable) => [
                insertable.elementPath.elementId,
                insertable.sortOrder
            ])
        ).toEqual([
            ["e1", 0],
            ["e2", 1]
        ]);
    });
});

describe("findRemovedInsertables", () => {
    it("returns ids of stored rows whose element left the document", () => {
        const removedIds = findRemovedInsertables(
            [tab("e1", "mv-2")],
            [storedRow("e1"), storedRow("gone")]
        );
        expect(removedIds).toEqual(["row-gone"]);
    });

    it("is empty when every stored row still has its element", () => {
        const removedIds = findRemovedInsertables(
            [tab("e1")],
            [storedRow("e1")]
        );
        expect(removedIds).toEqual([]);
    });
});
