import { describe, expect, it } from "vitest";
import {
    type MassAssembly,
    MassNodeKind,
    type MassNode,
    type MassPart
} from "@backend/features/mass-analysis/contract";
import { type MassUnit, Unit } from "@backend/features/configurations/enums";
import {
    findLevel,
    missingParts,
    formatMass,
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
    it("sizes tiles by mass, heaviest first, leaving out the massless", () => {
        const tiles = toTiles(
            [part("Light", 1), part("None"), part("Heavy", 2)],
            "blue"
        );

        expect(tiles.map((tile) => tile.id)).toEqual(["Heavy", "Light"]);
        expect(tiles[0].value).toBe(2);
    });
});

describe("formatMass", () => {
    it.each<[number, MassUnit, number, string]>([
        [2, Unit.KILOGRAM, 2, "2 kg"],
        [2, Unit.POUND, 2, "4.41 lb"],
        [2, Unit.POUND, 0, "4 lb"],
        [0.5, Unit.GRAM, 3, "500 g"],
        [0.45359237, Unit.OUNCE, 1, "16 oz"]
    ])(
        "shows %s kg in %s to %s places as %s",
        (kilograms, unit, precision, shown) => {
            expect(formatMass(kilograms, { unit, precision })).toBe(shown);
        }
    );
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
