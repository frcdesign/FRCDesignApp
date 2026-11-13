/** Outline meshes for fasteners, built from their dimensions. */
import { type PreviewPart, type PreviewShape } from "./protocol";

export interface PreviewMesh {
    /** Triangles, three vertices each, xyz. */
    positions: Float32Array;
    normals: Float32Array;
    /** Edge segments, two vertices each, xyz. */
    lines: Float32Array;
}

/** A point of a profile revolved about Z. */
type ProfilePoint = [radius: number, z: number];

const ROUND_SIDES = 32;
const HEX_SIDES = 6;

interface MeshBuilder {
    positions: number[];
    normals: number[];
    lines: number[];
}

const ring = (radius: number, z: number, angle: number) =>
    [radius * Math.cos(angle), radius * Math.sin(angle), z] as const;

/**
 * Sweeps `profile` about Z in `sides` flat or smooth steps. Lighting is
 * two-sided, so neither winding nor which way a normal points matters.
 */
function revolve(
    builder: MeshBuilder,
    profile: ProfilePoint[],
    sides: number,
    isSmooth: boolean
) {
    const step = (2 * Math.PI) / sides;
    for (let index = 0; index + 1 < profile.length; index++) {
        const [r0, z0] = profile[index];
        const [r1, z1] = profile[index + 1];
        const length = Math.hypot(r1 - r0, z1 - z0);
        if (length === 0) {
            continue;
        }
        const radial = (z1 - z0) / length;
        const axial = (r0 - r1) / length;
        for (let side = 0; side < sides; side++) {
            const a0 = side * step;
            const a1 = a0 + step;
            const corners = [
                ring(r0, z0, a0),
                ring(r1, z1, a0),
                ring(r1, z1, a1),
                ring(r0, z0, a0),
                ring(r1, z1, a1),
                ring(r0, z0, a1)
            ];
            const angles = [a0, a0, a1, a0, a1, a1];
            corners.forEach((corner, vertex) => {
                const angle = isSmooth ? angles[vertex] : a0 + step / 2;
                builder.positions.push(...corner);
                builder.normals.push(
                    radial * Math.cos(angle),
                    radial * Math.sin(angle),
                    axial
                );
            });
        }
    }

    for (const [radius, z] of profile) {
        if (radius === 0) {
            continue;
        }
        for (let side = 0; side < sides; side++) {
            builder.lines.push(
                ...ring(radius, z, side * step),
                ...ring(radius, z, (side + 1) * step)
            );
        }
    }
    if (isSmooth) {
        return;
    }
    // A prism's corners are edges too.
    for (let index = 0; index + 1 < profile.length; index++) {
        const [r0, z0] = profile[index];
        const [r1, z1] = profile[index + 1];
        if (r0 === 0 || r1 === 0) {
            continue;
        }
        for (let side = 0; side < sides; side++) {
            builder.lines.push(
                ...ring(r0, z0, side * step),
                ...ring(r1, z1, side * step)
            );
        }
    }
}

function addShape(builder: MeshBuilder, shape: PreviewShape) {
    switch (shape.kind) {
        case "screw": {
            const shank = shape.diameter / 2;
            const head = shape.headDiameter / 2;
            const profile: ProfilePoint[] = shape.isCountersunk
                ? [
                      [0, 0],
                      [head, 0],
                      [shank, -shape.headHeight],
                      [shank, -shape.length],
                      [0, -shape.length]
                  ]
                : [
                      [0, shape.headHeight],
                      [head, shape.headHeight],
                      [head, 0],
                      [shank, 0],
                      [shank, -shape.length],
                      [0, -shape.length]
                  ];
            revolve(builder, profile, ROUND_SIDES, true);
            return;
        }
        case "nut": {
            const corner =
                shape.acrossFlats / 2 / Math.cos(Math.PI / HEX_SIDES);
            revolve(
                builder,
                [
                    [0, 0],
                    [corner, 0],
                    [corner, shape.height],
                    [0, shape.height]
                ],
                HEX_SIDES,
                false
            );
            return;
        }
        case "washer": {
            const inner = shape.innerDiameter / 2;
            const outer = shape.outerDiameter / 2;
            revolve(
                builder,
                [
                    [inner, 0],
                    [outer, 0],
                    [outer, shape.thickness],
                    [inner, shape.thickness],
                    [inner, 0]
                ],
                ROUND_SIDES,
                true
            );
            return;
        }
    }
}

/** Moves xyz triples from `start` on by a row-major transform; directions skip its translation. */
function transformInPlace(
    values: number[],
    start: number,
    m: number[],
    isDirection: boolean
) {
    const w = isDirection ? 0 : 1;
    for (let index = start; index < values.length; index += 3) {
        const x = values[index];
        const y = values[index + 1];
        const z = values[index + 2];
        values[index] = m[0] * x + m[1] * y + m[2] * z + m[3] * w;
        values[index + 1] = m[4] * x + m[5] * y + m[6] * z + m[7] * w;
        values[index + 2] = m[8] * x + m[9] * y + m[10] * z + m[11] * w;
    }
}

/** Every part's shape, in place, as one mesh. */
export function buildPreviewMesh(parts: PreviewPart[]): PreviewMesh {
    const builder: MeshBuilder = { positions: [], normals: [], lines: [] };
    for (const part of parts) {
        const start = {
            positions: builder.positions.length,
            normals: builder.normals.length,
            lines: builder.lines.length
        };
        addShape(builder, part.shape);
        transformInPlace(
            builder.positions,
            start.positions,
            part.transform,
            false
        );
        transformInPlace(builder.normals, start.normals, part.transform, true);
        transformInPlace(builder.lines, start.lines, part.transform, false);
    }
    return {
        positions: Float32Array.from(builder.positions),
        normals: Float32Array.from(builder.normals),
        lines: Float32Array.from(builder.lines)
    };
}
