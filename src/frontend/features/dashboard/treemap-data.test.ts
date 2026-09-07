import { describe, expect, it } from "vitest";
import { LibraryId } from "@backend/features/library/library-id";
import { toNodes, TreemapKind, type UsagePart } from "./treemap-data";

function part({
    elementId = "e-1",
    ...overrides
}: Partial<UsagePart> & { elementId?: string } = {}): UsagePart {
    return {
        libraryId: LibraryId.FRC_DESIGN_LIB,
        path: {
            documentId: "doc-1",
            instanceId: "v-1",
            instanceType: "v",
            elementId
        },
        name: "Part",
        groupName: "Gearboxes",
        isVisible: true,
        insertCount: 0,
        usesPerMonth: 0,
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
    part({
        elementId: "e-4",
        name: "Colson",
        libraryId: LibraryId.MKCAD,
        groupName: "Wheels",
        insertCount: 40
    }),
    part({ elementId: "e-5", name: "Axle", groupName: "Motion" })
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
        // Color has to reinforce area, not fight it: a lighter tile always
        // means a smaller one.
        const many = Array.from({ length: 10 }, (_, index) =>
            part({ groupName: `g-${index}`, insertCount: 10 - index })
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
            part({ elementId: "a", groupName: "Wheels", insertCount: 3 }),
            part({
                elementId: "b",
                libraryId: LibraryId.MKCAD,
                groupName: "Wheels",
                insertCount: 9
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
