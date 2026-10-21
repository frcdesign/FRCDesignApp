import { describe, expect, it } from "vitest";
import { FastenerKind } from "./catalog";
import { HoleEnd, HoleStatus } from "./contract";
import { placements } from "./insert";
import { type HolePlan } from "./planner";

const INCH = 0.0254;

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
            length: "IN_1",
            washer: true
        },
        headWasher: {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "OD_1_2_X_0_049"
        },
        nut: {
            vendor: "GENERIC",
            size: "NO_10_32",
            type: "NYLOCK",
            washer: false
        }
    },
    exit: {
        point: [0, 0, -0.5 * INCH],
        edge: { occurrencePath: ["bottom"], edgeId: "B" }
    }
};

describe("placements", () => {
    const parts = placements([PLAN]);

    it("places the screw on its washer, and the nut on the far side, turned over", () => {
        expect(parts.map((part) => part.kind)).toEqual([
            FastenerKind.SCREW,
            FastenerKind.WASHER,
            FastenerKind.NUT
        ]);
        const [screw, washer, nut] = parts;
        // Raised by the 0.049 in. seat washer, pointing up
        expect(screw.transform[11]).toBeCloseTo(0.049 * INCH);
        expect(screw.transform[10]).toBeCloseTo(1);
        expect(washer.transform[11]).toBeCloseTo(0);
        expect(nut.transform[11]).toBeCloseTo(-0.5 * INCH);
        expect(nut.transform[10]).toBeCloseTo(-1);
        expect(screw.configuration).toEqual({
            vendor: "GENERIC",
            size: "NO_10_32",
            head: "BUTTON",
            length: "IN_1",
            washer: "true"
        });
        expect(nut.edge).toEqual({ occurrencePath: ["bottom"], edgeId: "B" });
        expect(screw.edge).toEqual({ occurrencePath: ["plate"], edgeId: "E" });
    });

    it("places nothing for a hole that isn't ready", () => {
        expect(
            placements([
                { ...PLAN, planned: { key: "x", status: HoleStatus.NO_FIT } }
            ])
        ).toEqual([]);
    });
});
