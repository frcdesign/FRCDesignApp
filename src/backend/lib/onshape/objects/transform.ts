/** The 4×4 transforms Onshape places an assembly instance with. */
import { type OnshapeMateConnectorCS } from "../types";

/**
 * Row-major, with the translation in the last column: Onshape's own example of a
 * 1.3 m shift along x is `[1,0,0,1.3, 0,1,0,0, 0,0,1,0, 0,0,0,1]`.
 */
export const IDENTITY_TRANSFORM = [
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0
];

function isVector(value: number[] | undefined): value is number[] {
    return value !== undefined && value.length === 3;
}

function cross(a: number[], b: number[]): number[] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

/**
 * The transform that lands an instance's origin on a mate connector, or
 * undefined when the coordinate system was not one we could read.
 *
 * The y axis is taken as z × x rather than read: a mate connector's frame is
 * orthonormal and right-handed, so the two axes Onshape names determine it, and
 * Onshape's schema spells its axis fields as Java getters (`getxAxis`), which
 * leaves it unclear which spelling the JSON actually carries.
 */
export function toTransform(
    coordinateSystem: OnshapeMateConnectorCS | undefined
): number[] | undefined {
    const origin = coordinateSystem?.origin;
    const x = coordinateSystem?.xAxis ?? coordinateSystem?.getxAxis;
    const z = coordinateSystem?.zAxis ?? coordinateSystem?.getzAxis;
    if (!isVector(origin) || !isVector(x) || !isVector(z)) {
        return undefined;
    }
    const y = cross(z, x);
    // Columns are the frame's axes; the last one is where it sits.
    // prettier-ignore
    return [
        x[0], y[0], z[0], origin[0],
        x[1], y[1], z[1], origin[1],
        x[2], y[2], z[2], origin[2],
        0, 0, 0, 1
    ];
}
