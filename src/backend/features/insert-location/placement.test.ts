import { describe, expect, it } from "vitest";
import { toMarkerPoint, type Point } from "./placement";

/** A box, as Onshape gives it: metres, low corner then high. */
function box(low: [number, number, number], high: [number, number, number]) {
    return {
        lowX: low[0],
        lowY: low[1],
        lowZ: low[2],
        highX: high[0],
        highY: high[1],
        highZ: high[2]
    };
}

/** Componentwise, so a clearance added in floating point still matches. */
function expectPoint(actual: Point, expected: Point) {
    actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis]));
}

describe("toMarkerPoint", () => {
    it("leaves the marker at the origin when nothing is over it", () => {
        expect(toMarkerPoint(box([1, 1, 1], [2, 2, 2]))).toEqual([0, 0, 0]);
    });

    it("leaves it at the origin when there is no box to clear", () => {
        expect(toMarkerPoint(undefined)).toEqual([0, 0, 0]);
    });

    it("leaves by the nearest face when the origin is inside", () => {
        // The +y face is 0.1 away; every other face is at least 1.
        expectPoint(
            toMarkerPoint(box([-1, -1, -1], [1, 0.1, 1])),
            [0, 0.11, 0]
        );
    });

    it("leaves by a low face just as readily as a high one", () => {
        expectPoint(
            toMarkerPoint(box([-1, -1, -0.05], [1, 1, 1])),
            [0, 0, -0.06]
        );
    });
});
