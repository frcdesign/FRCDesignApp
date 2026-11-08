import { describe, expect, it } from "vitest";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import { partUsage } from "../../../__test_utils__/part-usage-fixtures";
import {
    DEFAULT_SORT,
    filterAndSort,
    nextSort,
    type SortState
} from "./parts-sort";

/** Keyed by name, which the sort tests read the order back by. */
const part = (overrides: Partial<PartUsageOut> = {}) =>
    partUsage({ elementId: overrides.name, ...overrides });

const PARTS = [
    part({ name: "Bearing", useCount: 3, usesPerMonth: 3 }),
    part({
        name: "Tube",
        groupName: "Structure",
        useCount: 10,
        usesPerMonth: 1
    }),
    part({ name: "Axle", useCount: 0, usesPerMonth: 0 }),
    part({ name: "Spacer", useCount: 3, usesPerMonth: 3 })
];

const names = (parts: PartUsageOut[]) => parts.map((p) => p.name);

describe("filterAndSort", () => {
    it("puts the highest rate first by default, not the highest total", () => {
        // Tube has the most uses but the lowest rate.
        expect(names(filterAndSort(PARTS, "", DEFAULT_SORT))).toEqual([
            "Bearing",
            "Spacer",
            "Tube",
            "Axle"
        ]);
    });

    it("breaks a rounded rate tie on the raw total", () => {
        const parts = [
            part({ name: "Low", useCount: 5, usesPerMonth: 2 }),
            part({ name: "High", useCount: 40, usesPerMonth: 2 })
        ];
        expect(names(filterAndSort(parts, "", DEFAULT_SORT))).toEqual([
            "High",
            "Low"
        ]);
    });

    it("still sorts by lifetime total when asked", () => {
        const sort: SortState = { column: "useCount", descending: true };
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
        expect(nextSort(byName, "useCount")).toEqual({
            column: "useCount",
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
