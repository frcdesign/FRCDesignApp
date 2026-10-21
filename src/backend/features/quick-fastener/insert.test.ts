import { describe, expect, it } from "vitest";
import { FastenerKind } from "./catalog";
import { HoleEnd, HoleStatus } from "./contract";
import { partMate, placements, washerTopEdge } from "./insert";
import { type HolePlan } from "./planner";

const INCH = 0.0254;
const WASHER = { vendor: "GENERIC", size: "NO_10_32", type: "OD_1_2_X_0_049" };

const PLAN: HolePlan = {
    circle: {
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
            length: "IN_1"
        },
        startWasher: WASHER,
        nut: { vendor: "GENERIC", size: "NO_10_32", type: "NYLOCK" },
        endWasher: WASHER
    },
    exit: {
        point: [0, 0, -0.5 * INCH],
        edge: { occurrencePath: ["bottom"], edgeId: "B" }
    }
};

describe("placements", () => {
    const parts = placements([PLAN]);

    it("stacks each part on the one under it", () => {
        expect(parts.map((part) => part.kind)).toEqual([
            FastenerKind.WASHER,
            FastenerKind.SCREW,
            FastenerKind.WASHER,
            FastenerKind.NUT
        ]);
        const [startWasher, screw, endWasher, nut] = parts;
        expect(startWasher.seat).toEqual({
            edge: { occurrencePath: ["plate"], edgeId: "E" }
        });
        expect(screw.seat).toEqual({ washer: 0 });
        expect(endWasher.seat).toEqual({
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
        expect(screw.configuration).toEqual({
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            length: "IN_1",
            washer: "false"
        });
    });

    it("seats parts on the hole's edges without washers", () => {
        const bare = placements([
            {
                ...PLAN,
                planned: {
                    ...PLAN.planned,
                    startWasher: undefined,
                    endWasher: undefined
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
            placements([
                { ...PLAN, planned: { key: "x", status: HoleStatus.NO_FIT } }
            ])
        ).toEqual([]);
    });
});

describe("partMate", () => {
    const parts = placements([PLAN]);
    const paths = [["w1"], ["s1"], ["w2"], ["n1"]];

    it("fastens a part on a washer to the washer's top edge", () => {
        const mate = JSON.stringify(
            partMate(parts[1], ["s1"], "screwMC", paths, { 0: "TOP" })
        );
        expect(mate).toContain('"featureId":"screwMC"');
        expect(mate).toContain('"path":["w1"],"deterministicIds":["TOP"]');
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
