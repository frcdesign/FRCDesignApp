import { describe, expect, it } from "vitest";
import { FastenerKind } from "./studios";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { HoleEnd, HoleStatus } from "./contract";
import { partMate, placements } from "./insert";
import { type HolePlan } from "./planner";

const INCH = 0.0254;
const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };

const PLAN: HolePlan = {
    circularEdge: {
        key: "plate|E",
        occurrencePath: ["plate"],
        edgeId: "E",
        center: [0, 0, 0],
        normal: [0, 0, 1],
        radius: 0.0025
    },
    planned: {
        key: "plate|E",
        status: HoleStatus.READY,
        end: HoleEnd.THROUGH,
        depth: 0.5 * INCH,
        screw: {
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            finish: "BLACK",
            length: "IN_1",
            fullyThreaded: "false"
        },
        screwWasher: WASHER,
        nut: { vendor: "MCMASTER", size: "NO_10_32", type: "NYLOCK" },
        nutWasher: WASHER
    },
    exit: {
        point: [0, 0, -0.5 * INCH],
        edge: { occurrencePath: ["bottom"], edgeId: "B" },
        radius: 0.0025
    }
};

describe("placements", () => {
    const parts = placements(FASTENER_SET, [PLAN]);

    it("stacks each part on the one under it", () => {
        expect(parts.map((part) => part.kind)).toEqual([
            FastenerKind.WASHER,
            FastenerKind.SCREW,
            FastenerKind.WASHER,
            FastenerKind.NUT
        ]);
        const [screwWasher, screw, nutWasher, nut] = parts;
        expect(screwWasher.seat).toEqual({
            edge: { occurrencePath: ["plate"], edgeId: "E" }
        });
        expect(screw.seat).toEqual({ washer: 0 });
        expect(nutWasher.seat).toEqual({
            edge: { occurrencePath: ["bottom"], edgeId: "B" }
        });
        expect(nut.seat).toEqual({ washer: 2 });
    });

    it("places the screw on its washer pointing out, and the nut on the far side turned over", () => {
        const [, screw, , nut] = parts;
        expect(screw.transform[11]).toBeCloseTo(0.049 * INCH);
        expect(screw.transform[10]).toBeCloseTo(1);
        expect(nut.transform[11]).toBeCloseTo(-0.549 * INCH);
        expect(nut.transform[10]).toBeCloseTo(-1);
        // What differs from the studio's defaults
        expect(screw.configuration).toEqual({ length: "IN_1" });
    });

    it("seats parts on the hole's edges without washers", () => {
        const bare = placements(FASTENER_SET, [
            {
                ...PLAN,
                planned: {
                    ...PLAN.planned,
                    screwWasher: undefined,
                    nutWasher: undefined
                }
            }
        ]);
        expect(bare.map((part) => part.seat)).toEqual([
            { edge: { occurrencePath: ["plate"], edgeId: "E" } },
            { edge: { occurrencePath: ["bottom"], edgeId: "B" } }
        ]);
    });

    it("places nothing for a hole that isn't ready", () => {
        expect(
            placements(FASTENER_SET, [
                { ...PLAN, planned: { key: "x", status: HoleStatus.NO_FIT } }
            ])
        ).toEqual([]);
    });
});

describe("partMate", () => {
    const parts = placements(FASTENER_SET, [PLAN]);
    const paths = [["w1"], ["s1"], ["w2"], ["n1"]];

    it("fastens a part on a washer to the washer's top connector", () => {
        const mate = JSON.stringify(
            partMate(
                parts[1],
                ["s1"],
                "screwMC",
                paths,
                "washer.topMateConnector"
            )
        );
        expect(mate).toContain('"featureId":"screwMC","path":["s1"]');
        expect(mate).toContain(
            '"featureId":"washer.topMateConnector","path":["w1"]'
        );
        expect(mate).not.toContain('"mateConnectors":');
    });

    it("fastens a washer, or a part on no washer, to its hole's edge", () => {
        const mate = JSON.stringify(
            partMate(parts[0], ["w1"], "washerMC", paths, "washer.top")
        );
        expect(mate).toContain('"deterministicIds":["E"],"path":["plate"]');
    });

    it("fastens nothing on a washer that wasn't inserted", () => {
        expect(
            partMate(
                parts[1],
                ["s1"],
                "screwMC",
                [undefined, ["s1"]],
                "washer.top"
            )
        ).toBeUndefined();
    });
});
