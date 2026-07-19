import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/types";
import {
    type DocumentElement,
    type StoredInsertable,
    findOrphanedRows,
    selectElementsToLoad
} from "./load-group";

function tab(elementId: string, microversionId = "mv-1"): DocumentElement {
    return {
        elementId,
        name: `Tab ${elementId}`,
        elementType: ElementType.PART_STUDIO,
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
        supportsFasten: false,
        ...overrides
    };
}

describe("selectElementsToLoad", () => {
    it("mints an id for a brand-new element and loads it", () => {
        const toLoad = selectElementsToLoad([tab("e1")], [], false);
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0]).toMatchObject({
            elementId: "e1",
            supportsFasten: false
        });
        expect(toLoad[0].insertableId).toEqual(expect.any(String));
    });

    it("leaves an unchanged element alone", () => {
        const toLoad = selectElementsToLoad(
            [tab("e1")],
            [storedRow("e1")],
            false
        );
        expect(toLoad).toEqual([]);
    });

    it("reloads an element whose microversion changed, keeping its identity", () => {
        const toLoad = selectElementsToLoad(
            [tab("e1", "mv-2")],
            [storedRow("e1", { supportsFasten: true })],
            false
        );
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0]).toMatchObject({
            insertableId: "row-e1",
            supportsFasten: true
        });
    });

    it("reloads unchanged elements on forceReload", () => {
        const toLoad = selectElementsToLoad(
            [tab("e1")],
            [storedRow("e1")],
            true
        );
        expect(toLoad).toHaveLength(1);
        expect(toLoad[0].insertableId).toBe("row-e1");
    });

    it("ignores an orphaned row rather than loading it", () => {
        const toLoad = selectElementsToLoad(
            [tab("e1")],
            [storedRow("e1"), storedRow("gone")],
            false
        );
        expect(toLoad.map((element) => element.elementId)).toEqual([]);
    });

    it("seeds sortOrder from the tab position", () => {
        const toLoad = selectElementsToLoad([tab("e1"), tab("e2")], [], false);
        expect(
            toLoad.map((element) => [element.elementId, element.sortOrder])
        ).toEqual([
            ["e1", 0],
            ["e2", 1]
        ]);
    });
});

describe("findOrphanedRows", () => {
    it("returns ids of stored rows whose element left the document", () => {
        const staleIds = findOrphanedRows(
            [tab("e1", "mv-2")],
            [storedRow("e1"), storedRow("gone")]
        );
        expect(staleIds).toEqual(["row-gone"]);
    });

    it("is empty when every stored row still has its element", () => {
        const staleIds = findOrphanedRows([tab("e1")], [storedRow("e1")]);
        expect(staleIds).toEqual([]);
    });
});
