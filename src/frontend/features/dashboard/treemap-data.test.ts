import { describe, expect, it } from "vitest";
import type { GroupUsageOut } from "@backend/features/analytics/contract";
import { toGroupNodes, toPartNodes } from "./treemap-data";

const GROUPS: GroupUsageOut[] = [
    {
        groupName: "Gearboxes",
        insertCount: 30,
        parts: [
            { elementId: "e-1", name: "Versa", insertCount: 20 },
            { elementId: "e-2", name: "MAXPlanetary", insertCount: 10 }
        ]
    },
    {
        groupName: "Structure",
        insertCount: 5,
        parts: [{ elementId: "e-3", name: "Tube", insertCount: 5 }]
    }
];

describe("toGroupNodes", () => {
    it("keeps the order it was given, which is largest first", () => {
        const nodes = toGroupNodes(GROUPS, "frcGreen");
        expect(nodes.map((node) => node.name)).toEqual([
            "Gearboxes",
            "Structure"
        ]);
        expect(nodes.map((node) => node.value)).toEqual([30, 5]);
    });

    it("carries the group name and no element, so a click zooms", () => {
        const [node] = toGroupNodes(GROUPS, "frcGreen");
        expect(node.groupName).toBe("Gearboxes");
        expect(node.elementId).toBeUndefined();
    });

    it("never darkens as the tiles get smaller", () => {
        // Color has to reinforce area, not fight it: a lighter tile always
        // means a smaller one.
        const many = Array.from({ length: 10 }, (_, index) => ({
            groupName: `g-${index}`,
            insertCount: 10 - index,
            parts: []
        }));
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
        const nodes = toPartNodes(GROUPS, "Gearboxes", "frcGreen");
        expect(nodes.map((node) => node.name)).toEqual([
            "Versa",
            "MAXPlanetary"
        ]);
        expect(nodes[0].elementId).toBe("e-1");
        expect(nodes[0].groupName).toBeUndefined();
    });

    it("returns nothing when the group is not in the range", () => {
        // A range change can drop the group that was zoomed into.
        expect(toPartNodes(GROUPS, "Vanished", "frcGreen")).toEqual([]);
    });
});
