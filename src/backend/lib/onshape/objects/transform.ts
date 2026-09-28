/** The 4×4 transforms Onshape places an assembly instance with. */

/** Row-major, translation in the last column. */
// prettier-ignore
export const IDENTITY_TRANSFORM = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
];

/** Moves an instance to a point, in metres, without turning it. */
export function toTranslation(point: [number, number, number]): number[] {
    // prettier-ignore
    return [
        1, 0, 0, point[0],
        0, 1, 0, point[1],
        0, 0, 1, point[2],
        0, 0, 0, 1
    ];
}
