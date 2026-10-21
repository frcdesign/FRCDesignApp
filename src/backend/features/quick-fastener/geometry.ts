/** Points, directions and Onshape's row-major 4×4 transforms, in metres. */

export type Vec3 = [number, number, number];

/** Closer than this along or off an axis is the same place: far above Onshape's 1e-8 m tolerance, far below any part. */
export const LINEAR_TOLERANCE = 1e-5;

/** Sine of the largest angle between axes still counted parallel. */
const ANGULAR_TOLERANCE = 1e-6;

export function add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, factor: number): Vec3 {
    return [a[0] * factor, a[1] * factor, a[2] * factor];
}

export function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

export function norm(a: Vec3): number {
    return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
    return scale(a, 1 / norm(a));
}

export function isParallel(a: Vec3, b: Vec3): boolean {
    return norm(cross(normalize(a), normalize(b))) < ANGULAR_TOLERANCE;
}

/** How far `point` is from the line through `origin` along unit `direction`. */
export function distanceToLine(
    point: Vec3,
    origin: Vec3,
    direction: Vec3
): number {
    const offset = subtract(point, origin);
    return norm(subtract(offset, scale(direction, dot(offset, direction))));
}

export function transformPoint(transform: number[], point: Vec3): Vec3 {
    const [x, y, z] = point;
    return [
        transform[0] * x + transform[1] * y + transform[2] * z + transform[3],
        transform[4] * x + transform[5] * y + transform[6] * z + transform[7],
        transform[8] * x + transform[9] * y + transform[10] * z + transform[11]
    ];
}

export function transformDirection(transform: number[], direction: Vec3): Vec3 {
    const [x, y, z] = direction;
    return normalize([
        transform[0] * x + transform[1] * y + transform[2] * z,
        transform[4] * x + transform[5] * y + transform[6] * z,
        transform[8] * x + transform[9] * y + transform[10] * z
    ]);
}

/** The transform putting a part's origin at `origin` with its Z axis along unit `zAxis`. */
export function frameTransform(origin: Vec3, zAxis: Vec3): number[] {
    // Any X perpendicular to Z: a fastener is round, so its turn about its axis doesn't matter.
    const helper: Vec3 = Math.abs(zAxis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const xAxis = normalize(cross(helper, zAxis));
    const yAxis = cross(zAxis, xAxis);
    // prettier-ignore
    return [
        xAxis[0], yAxis[0], zAxis[0], origin[0],
        xAxis[1], yAxis[1], zAxis[1], origin[1],
        xAxis[2], yAxis[2], zAxis[2], origin[2],
        0, 0, 0, 1
    ];
}
