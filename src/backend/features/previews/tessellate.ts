/**
 * A Part Studio configuration's parts as one preview mesh, from Onshape's
 * tessellation. Its answers' shape is in docs/ONSHAPE.md; both forms of a
 * point it could take are read.
 */
import { type Selection } from "../configurations/contract";
import { type OnshapeApi } from "../../lib/onshape/client";
import {
    getTessellatedEdges,
    getTessellatedFaces
} from "../../lib/onshape/endpoints/part-studios";
import { type ElementPath } from "../../lib/onshape/path";
import { type PreviewMesh } from "./contract";

type Point = [number, number, number];

/** `[x, y, z]`, or `{ x, y, z }` as the spec writes a `BTVector3d`. */
function toPoint(value: unknown): Point | undefined {
    if (Array.isArray(value)) {
        const [x, y, z] = value as unknown[];
        return [x, y, z].every((n) => typeof n === "number")
            ? [x as number, y as number, z as number]
            : undefined;
    }
    if (typeof value === "object" && value !== null) {
        const { x, y, z } = value as Record<string, unknown>;
        return typeof x === "number" &&
            typeof y === "number" &&
            typeof z === "number"
            ? [x, y, z]
            : undefined;
    }
    return undefined;
}

function toPoints(value: unknown): Point[] {
    return Array.isArray(value)
        ? value.flatMap((entry) => {
              const point = toPoint(entry);
              return point ? [point] : [];
          })
        : [];
}

const asArray = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];

const field = (value: unknown, name: string): unknown =>
    typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[name]
        : undefined;

/** The answer's bodies: a bare array, or under `bodies`. */
function bodiesOf(response: unknown): unknown[] {
    return Array.isArray(response)
        ? response
        : asArray(field(response, "bodies"));
}

/** Coincident vertices with one normal are one, which shrinks a mesh several times over. */
const VERTEX_PRECISION = 1e7;

class MeshBuilder {
    private readonly positions: number[] = [];
    private readonly normals: number[] = [];
    private readonly indices: number[] = [];
    private readonly lookup = new Map<string, number>();

    add(position: Point, normal: Point) {
        const key = [...position, ...normal]
            .map((n) => Math.round(n * VERTEX_PRECISION))
            .join(",");
        let index = this.lookup.get(key);
        if (index === undefined) {
            index = this.positions.length / 3;
            this.lookup.set(key, index);
            this.positions.push(...position);
            this.normals.push(...normal);
        }
        this.indices.push(index);
    }

    build(edges: number[]): PreviewMesh {
        return {
            positions: Float32Array.from(this.positions),
            normals: Float32Array.from(this.normals),
            indices: Uint32Array.from(this.indices),
            edges: Float32Array.from(edges)
        };
    }
}

function facetNormal([a, b, c]: Point[]): Point {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: Point = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
    ];
    const length = Math.hypot(...n) || 1;
    return [n[0] / length, n[1] / length, n[2] / length];
}

/**
 * A facet's three corners, each with its normal: the vertex's own where
 * Onshape sent them, else the facet's. With an index table, a facet's corners
 * index the body's `facetPoints`.
 */
function facetCorners(
    facet: unknown,
    facetPoints: Point[]
): [Point, Point][] | undefined {
    const indices = asArray(field(facet, "indices"));
    const vertices =
        indices.length === 3
            ? indices.map((index) =>
                  typeof index === "number" ? facetPoints[index] : undefined
              )
            : toPoints(field(facet, "vertices"));
    if (vertices.length !== 3 || vertices.some((vertex) => !vertex)) {
        return undefined;
    }
    const corners = vertices as Point[];
    const normals = toPoints(field(facet, "normals"));
    const shared = toPoint(field(facet, "normal")) ?? facetNormal(corners);
    return corners.map((corner, index) => [
        corner,
        normals.length === 3 ? normals[index] : shared
    ]);
}

export function toPreviewMesh(faces: unknown, edges: unknown): PreviewMesh {
    const builder = new MeshBuilder();
    for (const body of bodiesOf(faces)) {
        const facetPoints = toPoints(field(body, "facetPoints"));
        for (const face of asArray(field(body, "faces"))) {
            for (const facet of asArray(field(face, "facets"))) {
                const corners = facetCorners(facet, facetPoints);
                corners?.forEach(([position, normal]) => {
                    builder.add(position, normal);
                });
            }
        }
    }
    const segments: number[] = [];
    for (const body of bodiesOf(edges)) {
        for (const edge of asArray(field(body, "edges"))) {
            const points = toPoints(field(edge, "vertices"));
            for (let index = 0; index + 1 < points.length; index++) {
                segments.push(...points[index], ...points[index + 1]);
            }
        }
    }
    return builder.build(segments);
}

/** Two calls to Onshape, under the caller's session. */
export async function tessellate(
    client: OnshapeApi,
    path: ElementPath,
    configuration: Selection
): Promise<PreviewMesh> {
    const [faces, edges] = await Promise.all([
        getTessellatedFaces(client, path, configuration),
        getTessellatedEdges(client, path, configuration)
    ]);
    return toPreviewMesh(faces, edges);
}
