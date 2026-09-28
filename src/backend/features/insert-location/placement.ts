/** Where a new insert location marker goes. */
import { type OnshapeBoundingBox } from "../../lib/onshape/types";

/** In metres; enough to grab the marker. */
const CLEARANCE = 0.01;

export type Point = [number, number, number];

const ORIGIN: Point = [0, 0, 0];

/**
 * The origin if nothing covers it, else just past the nearest face: buried
 * markers can't be grabbed and far-flung ones can't be found. No box leaves it
 * at the origin.
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

    // `low` <= 0 <= `high` here, so each distance is the face's magnitude.
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
