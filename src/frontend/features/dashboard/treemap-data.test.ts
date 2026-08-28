import { describe, expect, it } from "vitest";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import { toGroupNodes, toPartNodes } from "./treemap-data";

function part(overrides: Partial<PartUsageOut> = {}): PartUsageOut {
    return {
        elementId: "e-1",
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
    part({ elementId: "e-1", name: "Versa", insertCount: 20 }),
    part({ elementId: "e-2", name: "MAXPlanetary", insertCount: 10 }),
    part({
        elementId: "e-3",
        name: "Tube",
        groupName: "Structure",
        insertCount: 5
    }),
    part({ elementId: "e-4", name: "Axle", groupName: "Motion" })
];

describe("toGroupNodes", () => {
    it("sums a group over its parts, largest group first", () => {
        const nodes = toGroupNodes(PARTS, "frcGreen");
        expect(nodes.map((node) => node.name)).toEqual([
            "Gearboxes",
            "Structure"
        ]);
        expect(nodes.map((node) => node.value)).toEqual([30, 5]);
    });

    it("drops a group whose parts went unused in the window", () => {
        // Motion's only part has no uses, so it has no area to draw.
        expect(
            toGroupNodes(PARTS, "frcGreen").some(
                (node) => node.name === "Motion"
            )
        ).toBe(false);
    });

    it("carries the group name and no element, so a click zooms", () => {
        const [node] = toGroupNodes(PARTS, "frcGreen");
        expect(node.groupName).toBe("Gearboxes");
        expect(node.elementId).toBeUndefined();
    });

    it("never darkens as the tiles get smaller", () => {
        // Color has to reinforce area, not fight it: a lighter tile always
        // means a smaller one.
        const many = Array.from({ length: 10 }, (_, index) =>
            part({ groupName: `g-${index}`, insertCount: 10 - index })
        );
        const shade = /-(\d+)\)$/;
        const steps = toGroupNodes(many, "frcGreen").map((node) =>
            Number(shade.exec(node.color)?.[1])
        );
        for (let i = 1; i < steps.length; i++) {
            expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
        }
    });

    it("returns nothing for a window with no insertions", () => {
        expect(toGroupNodes([], "frcGreen")).toEqual([]);
    });
});

describe("toPartNodes", () => {
    it("carries the element and no group name, so a click navigates", () => {
        const nodes = toPartNodes(PARTS, "Gearboxes", "frcGreen");
        expect(nodes.map((node) => node.name)).toEqual([
            "Versa",
            "MAXPlanetary"
        ]);
        expect(nodes[0].elementId).toBe("e-1");
        expect(nodes[0].groupName).toBeUndefined();
    });

    it("returns nothing when the group is not in the range", () => {
        // A range change can drop the group that was zoomed into.
        expect(toPartNodes(PARTS, "Motion", "frcGreen")).toEqual([]);
    });
});
