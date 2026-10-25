import { describe, expect, it } from "vitest";
import { FastenerKind } from "./studios";
import { FASTENER_SET } from "../../../__test_utils__/fastener-set";
import { HoleEnd, HoleStatus } from "./contract";
import {
    PartStack,
    partMate,
    placements,
    replicateGroups,
    stackTargets,
    washerTopEdge
} from "./insert";
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
        expect(parts.map((part) => part.stack)).toEqual([
            PartStack.SCREW,
            PartStack.SCREW,
            PartStack.NUT,
            PartStack.NUT
        ]);
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

describe("replicateGroups", () => {
    const at = (key: string, change: Partial<HolePlan["planned"]> = {}) => ({
        ...PLAN,
        circularEdge: { ...PLAN.circularEdge, key, edgeId: key },
        planned: { ...PLAN.planned, key, ...change }
    });

    it("groups ready holes given the same parts as deep, the first found first", () => {
        const groups = replicateGroups([
            at("a"),
            at("b", { depth: 0.75 * INCH }),
            at("c"),
            at("d", { status: HoleStatus.FASTENED }),
            at("e", { nutWasher: undefined }),
            { ...at("f"), exit: { ...PLAN.exit!, radius: 0.004 } }
        ]);
        expect(
            groups.map((group) => group.map((plan) => plan.planned.key))
        ).toEqual([["a", "c"], ["b"], ["e"], ["f"]]);
    });
});

describe("stackTargets", () => {
    const hole = (key: string): HolePlan => ({
        ...PLAN,
        circularEdge: { ...PLAN.circularEdge, key, edgeId: key },
        planned: { ...PLAN.planned, key },
        exit: {
            ...PLAN.exit!,
            edge: { occurrencePath: ["bottom"], edgeId: `${key}-far` }
        }
    });
    const group = [hole("a"), hole("b"), hole("c")];

    it("puts the screw's stack on the rest's circular edges", () => {
        expect(stackTargets(group, PartStack.SCREW)).toEqual([
            { deterministicId: "b", path: ["plate"] },
            { deterministicId: "c", path: ["plate"] }
        ]);
    });

    it("puts the nut's stack on the rest's far edges", () => {
        expect(stackTargets(group, PartStack.NUT)).toEqual([
            { deterministicId: "b-far", path: ["bottom"] },
            { deterministicId: "c-far", path: ["bottom"] }
        ]);
    });
});

describe("partMate", () => {
    const parts = placements(FASTENER_SET, [PLAN]);
    const paths = [["w1"], ["s1"], ["w2"], ["n1"]];

    it("fastens a part on a washer to the washer's top edge", () => {
        const mate = JSON.stringify(
            partMate(parts[1], ["s1"], "screwMC", paths, { 0: "TOP" })
        );
        expect(mate).toContain('"featureId":"screwMC"');
        expect(mate).toContain('"deterministicIds":["TOP"],"path":["w1"]');
    });

    it("fastens nothing it can't find the washer's edge for", () => {
        expect(
            partMate(parts[1], ["s1"], "screwMC", paths, {})
        ).toBeUndefined();
    });
});

describe("washerTopEdge", () => {
    it("is the edge farthest up the washer's Z axis, whichever way its hole points", () => {
        const hole = (direction: [number, number, number], start: number) => ({
            faceId: "F",
            origin: [0, 0, start] as [number, number, number],
            direction,
            radius: 0.002,
            start: 0,
            end: 0.001,
            closedAtStart: false,
            closedAtEnd: false,
            threaded: false,
            edges: [
                { id: "A", at: 0 },
                { id: "B", at: 0.001 }
            ]
        });
        expect(washerTopEdge({ W: { holes: [hole([0, 0, 1], 0)] } })).toBe("B");
        expect(washerTopEdge({ W: { holes: [hole([0, 0, -1], 0.001)] } })).toBe(
            "A"
        );
    });
});
