import { describe, expect, it } from "vitest";
import {
    type MassAssembly,
    MassNodeKind,
    type MassNode,
    type MassPart
} from "@backend/features/mass-analysis/contract";
import { MassUnit } from "@backend/features/configurations/enums";
import {
    findLevel,
    missingParts,
    inUnit,
    roundTo,
    sumMass,
    toTiles,
    totalMass
} from "./mass-data";

function part(id: string, mass?: number, quantity = 1): MassPart {
    return {
        kind: MassNodeKind.PART,
        id,
        name: id,
        quantity,
        mass,
        partKey: `${id}-studio|JHD`,
        occurrences: [[`${id}-instance`]]
    };
}

function assembly(
    id: string,
    children: MassNode[],
    options: { quantity?: number; isLibrary?: boolean } = {}
): MassAssembly {
    return {
        kind: MassNodeKind.ASSEMBLY,
        id,
        name: id,
        quantity: options.quantity ?? 1,
        isLibrary: options.isLibrary ?? false,
        children
    };
}

describe("totalMass", () => {
    it("counts every one of each, through each level", () => {
        const swerve = assembly("Swerve", [part("Wheel", 0.5, 2)], {
            quantity: 4
        });

        expect(totalMass(swerve)).toBe(4);
        expect(sumMass([swerve, part("Plate", 1)])).toBe(5);
    });

    it("counts a part with no mass as nothing", () => {
        expect(totalMass(part("Plate"))).toBe(0);
    });
});

describe("findLevel", () => {
    const report = {
        children: [
            assembly("Drivetrain", [assembly("Gearbox", [part("Gear", 1)])]),
            assembly("Library gearbox", [part("Gear", 1)], { isLibrary: true })
        ]
    };

    it("opens each subassembly on the path", () => {
        const level = findLevel(report, ["Drivetrain", "Gearbox"]);

        expect(level.trail.map((node) => node.id)).toEqual([
            "Drivetrain",
            "Gearbox"
        ]);
        expect(level.children.map((node) => node.id)).toEqual(["Gear"]);
    });

    it("stops where the path no longer leads, or at a library's assembly", () => {
        expect(findLevel(report, ["Drivetrain", "Gone"]).trail).toHaveLength(1);
        expect(findLevel(report, ["Library gearbox"]).trail).toHaveLength(0);
    });
});

describe("toTiles", () => {
    it("sizes tiles in pounds, heaviest first, leaving out the massless", () => {
        const tiles = toTiles(
            [part("Light", 1), part("None"), part("Heavy", 2)],
            "blue",
            MassUnit.POUND
        );

        expect(tiles.map((tile) => tile.id)).toEqual(["Heavy", "Light"]);
        expect(tiles[0].value).toBeCloseTo(4.40925);
    });
});

describe("units", () => {
    it("converts kilograms to the document's unit", () => {
        expect(inUnit(1, MassUnit.KILOGRAM)).toBe(1);
        expect(inUnit(1, MassUnit.GRAM)).toBeCloseTo(1000);
        expect(inUnit(0.45359237, MassUnit.POUND)).toBeCloseTo(1);
        expect(inUnit(0.45359237, MassUnit.OUNCE)).toBeCloseTo(16);
    });

    it("rounds to the document's precision", () => {
        expect(roundTo(4.40925, 2)).toBe(4.41);
        expect(roundTo(4.40925, 0)).toBe(4);
    });
});

describe("missingParts", () => {
    it("lists a part once, with how many the level holds", () => {
        const missing = missingParts([
            assembly("Module", [part("Bracket", undefined, 2)], {
                quantity: 4
            }),
            part("Bracket"),
            part("Plate", 1)
        ]);

        expect(missing).toHaveLength(1);
        expect(missing[0]).toMatchObject({ count: 9, within: "Module" });
        expect(missing[0].occurrences).toEqual([
            ["Bracket-instance"],
            ["Bracket-instance"]
        ]);
    });

    it("leaves out what's inside a library's assembly", () => {
        expect(
            missingParts([
                assembly("Library gearbox", [part("Gear")], { isLibrary: true })
            ])
        ).toEqual([]);
    });
});
