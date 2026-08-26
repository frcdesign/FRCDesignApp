import { describe, expect, it } from "vitest";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import {
    DEFAULT_SORT,
    filterAndSort,
    nextSort,
    type SortState
} from "./parts-sort";

function part(overrides: Partial<PartUsageOut> = {}): PartUsageOut {
    return {
        elementId: overrides.name ?? "e-1",
        insertableId: "i-1",
        name: "Part",
        groupName: "Gearboxes",
        documentId: "doc-1",
        versionId: "v-1",
        isVisible: true,
        insertCount: 0,
        usesPerMonth: 0,
        lastInsertedAt: null,
        recent: [],
        ...overrides
    };
}

const PARTS = [
    part({
        name: "Bearing",
        insertCount: 3,
        usesPerMonth: 3,
        lastInsertedAt: 300
    }),
    part({
        name: "Tube",
        groupName: "Structure",
        insertCount: 10,
        usesPerMonth: 1
    }),
    part({ name: "Axle", insertCount: 0, usesPerMonth: 0 }),
    part({
        name: "Spacer",
        insertCount: 3,
        usesPerMonth: 3,
        lastInsertedAt: 100
    })
];

const names = (parts: PartUsageOut[]) => parts.map((p) => p.name);

describe("filterAndSort", () => {
    it("puts the highest rate first by default, not the highest total", () => {
        // Tube has the most insertions but the lowest rate, so it drops below
        // the two parts earning three a month.
        expect(names(filterAndSort(PARTS, "", DEFAULT_SORT))).toEqual([
            "Bearing",
            "Spacer",
            "Tube",
            "Axle"
        ]);
    });

    it("breaks a rounded rate tie on the raw total", () => {
        const parts = [
            part({ name: "Low", insertCount: 5, usesPerMonth: 2 }),
            part({ name: "High", insertCount: 40, usesPerMonth: 2 })
        ];
        expect(names(filterAndSort(parts, "", DEFAULT_SORT))).toEqual([
            "High",
            "Low"
        ]);
    });

    it("still sorts by lifetime total when asked", () => {
        const sort: SortState = { column: "insertCount", descending: true };
        expect(names(filterAndSort(PARTS, "", sort))).toEqual([
            "Tube",
            "Bearing",
            "Spacer",
            "Axle"
        ]);
    });

    it("breaks ties on name rather than arrival order", () => {
        const reversed = [...PARTS].reverse();
        expect(names(filterAndSort(reversed, "", DEFAULT_SORT))).toEqual(
            names(filterAndSort(PARTS, "", DEFAULT_SORT))
        );
    });

    it("sorts a never-used part as the oldest, not the newest", () => {
        const sort: SortState = { column: "lastInsertedAt", descending: true };
        expect(names(filterAndSort(PARTS, "", sort))).toEqual([
            "Bearing",
            "Spacer",
            "Axle",
            "Tube"
        ]);
    });

    it("matches on the group name too", () => {
        const sort = DEFAULT_SORT;
        expect(names(filterAndSort(PARTS, "structure", sort))).toEqual([
            "Tube"
        ]);
    });

    it("ignores case and surrounding space", () => {
        expect(names(filterAndSort(PARTS, "  BEAR ", DEFAULT_SORT))).toEqual([
            "Bearing"
        ]);
    });

    it("leaves the list alone when the search is empty", () => {
        expect(filterAndSort(PARTS, "   ", DEFAULT_SORT)).toHaveLength(
            PARTS.length
        );
    });
});

describe("nextSort", () => {
    it("flips direction when the same column is clicked again", () => {
        expect(nextSort(DEFAULT_SORT, "usesPerMonth")).toEqual({
            column: "usesPerMonth",
            descending: false
        });
    });

    it("starts a count column at its largest value", () => {
        const byName: SortState = { column: "name", descending: false };
        expect(nextSort(byName, "insertCount")).toEqual({
            column: "insertCount",
            descending: true
        });
    });

    it("starts a name column at A", () => {
        expect(nextSort(DEFAULT_SORT, "name")).toEqual({
            column: "name",
            descending: false
        });
    });
});
