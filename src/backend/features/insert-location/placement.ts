/** Where a new insert location marker goes. */
import { type OnshapeBoundingBox } from "../../lib/onshape/types";

/**
 * How far past the face the marker sits, in metres. Enough to be grabbable
 * rather than flush against the geometry it is clearing.
 */
const CLEARANCE = 0.01;

export type Point = [number, number, number];

const ORIGIN: Point = [0, 0, 0];

/**
 * The closest point to the origin that is clear of the assembly's geometry: the
 * origin itself when nothing is over it, and otherwise just past whichever of
 * the six faces the origin is nearest. A marker buried inside the robot cannot
 * be grabbed, and one flung to a corner cannot be found.
 *
 * No box — an empty assembly, or a call that failed — leaves it at the origin.
 */
export function toMarkerPoint(box: OnshapeBoundingBox | undefined): Point {
    if (!box) {
        return ORIGIN;
    }

    const axes: [number, number][] = [
        [box.lowX, box.highX],
        [box.lowY, box.highY],
        [box.lowZ, box.highZ]
    ];

    // Already clear on an axis the origin falls outside of, so it stays put.
    if (axes.some(([low, high]) => low > 0 || high < 0)) {
        return ORIGIN;
    }

    // Inside: leave by the nearest face. `low` is at or below zero here and
    // `high` at or above it, so each distance is the face's own magnitude.
    const exits = axes.flatMap(([low, high], axis) => [
        { axis, to: low - CLEARANCE, distance: -low },
        { axis, to: high + CLEARANCE, distance: high }
    ]);
    const nearest = exits.reduce((best, exit) =>
        exit.distance < best.distance ? exit : best
    );

    const point: Point = [0, 0, 0];
    point[nearest.axis] = nearest.to;
    return point;
}
