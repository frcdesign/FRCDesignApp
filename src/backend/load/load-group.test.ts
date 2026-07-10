import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/types";
import {
    type DocumentElement,
    type DocumentSnapshot,
    type ExistingInsertable,
    planInsertables,
    shouldSkipGroup
} from "./load-group";

function tab(elementId: string, microversionId = "mv-1"): DocumentElement {
    return {
        elementId,
        name: `Tab ${elementId}`,
        elementType: ElementType.PART_STUDIO,
        microversionId
    };
}

function snapshot(
    tabs: DocumentElement[],
    orderedTabIds = tabs.map((t) => t.elementId)
): DocumentSnapshot {
    return { tabs, orderedTabIds };
}

function existingRow(
    elementId: string,
    overrides: Partial<ExistingInsertable> = {}
): ExistingInsertable {
    return {
        id: `row-${elementId}`,
        elementId,
        microversionId: "mv-1",
        supportsFasten: false,
        ...overrides
    };
}

describe("planInsertables", () => {
    it("mints an id for a brand-new element and marks it for loading", () => {
        const { jobs, staleInsertableIds } = planInsertables(
            snapshot([tab("e1")]),
            [],
            false
        );
        expect(staleInsertableIds).toEqual([]);
        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toMatchObject({
            elementId: "e1",
            isNew: true,
            supportsFasten: false,
            needsReload: true
        });
        expect(jobs[0].insertableId).toEqual(expect.any(String));
    });

    it("skips an unchanged element but keeps its stored identity", () => {
        const { jobs } = planInsertables(
            snapshot([tab("e1")]),
            [existingRow("e1", { supportsFasten: true })],
            false
        );
        expect(jobs[0]).toMatchObject({
            insertableId: "row-e1",
            isNew: false,
            supportsFasten: true,
            needsReload: false
        });
    });

    it("reloads an element whose microversion changed", () => {
        const { jobs } = planInsertables(
            snapshot([tab("e1", "mv-2")]),
            [existingRow("e1")],
            false
        );
        expect(jobs[0]).toMatchObject({
            insertableId: "row-e1",
            needsReload: true
        });
    });

    it("reloads unchanged elements on forceReload", () => {
        const { jobs } = planInsertables(
            snapshot([tab("e1")]),
            [existingRow("e1")],
            true
        );
        expect(jobs[0].needsReload).toBe(true);
    });

    it("marks rows whose element left the document as stale", () => {
        const { jobs, staleInsertableIds } = planInsertables(
            snapshot([tab("e1")]),
            [existingRow("e1"), existingRow("gone")],
            false
        );
        expect(jobs.map((job) => job.elementId)).toEqual(["e1"]);
        expect(staleInsertableIds).toEqual(["row-gone"]);
    });

    it("seeds sortOrder from the display order", () => {
        const { jobs } = planInsertables(
            snapshot([tab("e1"), tab("e2")], ["e2", "e1"]),
            [],
            false
        );
        expect(jobs.map((job) => [job.elementId, job.sortOrder])).toEqual([
            ["e1", 1],
            ["e2", 0]
        ]);
    });
});

describe("shouldSkipGroup", () => {
    it("skips when the stored version matches the latest", () => {
        expect(shouldSkipGroup("v1", "v1", false)).toBe(true);
    });

    it("loads when the document has a new version", () => {
        expect(shouldSkipGroup("v1", "v2", false)).toBe(false);
    });

    it("never skips on forceReload", () => {
        expect(shouldSkipGroup("v1", "v1", true)).toBe(false);
    });

    it("never skips an AddGroup shell's placeholder version", () => {
        expect(shouldSkipGroup("", "v1", false)).toBe(false);
    });
});
