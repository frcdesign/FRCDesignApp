import { describe, expect, it } from "vitest";
import { LibraryId } from "@backend/features/library/library-id";
import { partUsage } from "../../../__test_utils__/part-usage-fixtures";
import { toNodes, TreemapKind } from "./treemap-data";

const PARTS = [
    partUsage({ elementId: "e-1", name: "Versa", useCount: 20 }),
    partUsage({ elementId: "e-2", name: "MAXPlanetary", useCount: 10 }),
    partUsage({
        elementId: "e-3",
        name: "Tube",
        groupName: "Structure",
        useCount: 5
    }),
    partUsage({
        elementId: "e-4",
        name: "Colson",
        libraryId: LibraryId.MKCAD,
        groupName: "Wheels",
        useCount: 40
    }),
    partUsage({ elementId: "e-5", name: "Axle", groupName: "Motion" })
];

describe("toNodes at the library level", () => {
    const nodes = toNodes(PARTS, {});

    it("sums each library over all of its parts, largest first", () => {
        expect(nodes.map((node) => node.name)).toEqual([
            "MKCad",
            "FRCDesignLib"
        ]);
        expect(nodes.map((node) => node.value)).toEqual([40, 35]);
    });

    it("is a library tile, so a click descends one level", () => {
        expect(nodes[0]).toMatchObject({
            kind: TreemapKind.LIBRARY,
            libraryId: LibraryId.MKCAD
        });
    });

    it("gives each library its own color rather than a rank shade", () => {
        // Matching the charts, so a library reads the same everywhere.
        expect(nodes[0].color).toContain("blue");
        expect(nodes[1].color).toContain("frcGreen");
    });
});

describe("toNodes at the group level", () => {
    const path = { libraryId: LibraryId.FRC_DESIGN_LIB };

    it("shows only the named library's groups", () => {
        const nodes = toNodes(PARTS, path);
        expect(nodes.map((node) => node.name)).toEqual([
            "Gearboxes",
            "Structure"
        ]);
        expect(nodes.map((node) => node.value)).toEqual([30, 5]);
    });

    it("drops a group whose parts went unused in the window", () => {
        // Motion's only part has no uses, so it has no area to draw.
        expect(
            toNodes(PARTS, path).some((node) => node.name === "Motion")
        ).toBe(false);
    });

    it("never darkens as the tiles get smaller", () => {
        const many = Array.from({ length: 10 }, (_, index) =>
            partUsage({ groupName: `g-${index}`, useCount: 10 - index })
        );
        const shade = /-(\d+)\)$/;
        const steps = toNodes(many, path).map((node) =>
            Number(shade.exec(node.color)?.[1])
        );
        for (let i = 1; i < steps.length; i++) {
            expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
        }
    });
});

describe("toNodes at the part level", () => {
    const path = {
        libraryId: LibraryId.FRC_DESIGN_LIB,
        groupName: "Gearboxes"
    };

    it("carries the element and its library, so a click navigates", () => {
        const nodes = toNodes(PARTS, path);
        expect(nodes.map((node) => node.name)).toEqual([
            "Versa",
            "MAXPlanetary"
        ]);
        expect(nodes[0]).toMatchObject({
            kind: TreemapKind.PART,
            elementId: "e-1",
            libraryId: LibraryId.FRC_DESIGN_LIB
        });
    });

    it("returns nothing when the group is not in the range", () => {
        // A range change can drop the group that was zoomed into.
        expect(toNodes(PARTS, { ...path, groupName: "Vanished" })).toEqual([]);
    });

    it("never mixes in another library's group of the same name", () => {
        const shared = [
            partUsage({ elementId: "a", groupName: "Wheels", useCount: 3 }),
            partUsage({
                elementId: "b",
                libraryId: LibraryId.MKCAD,
                groupName: "Wheels",
                useCount: 9
            })
        ];
        const nodes = toNodes(shared, {
            libraryId: LibraryId.MKCAD,
            groupName: "Wheels"
        });

        expect(nodes).toMatchObject([
            { kind: TreemapKind.PART, elementId: "b" }
        ]);
    });
});

describe("toNodes with nothing to draw", () => {
    it("returns an empty list rather than throwing", () => {
        expect(toNodes([], {})).toEqual([]);
    });
});
