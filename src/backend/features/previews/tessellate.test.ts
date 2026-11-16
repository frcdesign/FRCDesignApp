import { describe, expect, it } from "vitest";
import { decodePreviewMesh, encodePreviewMesh } from "./contract";
import { toPreviewMesh } from "./tessellate";

/** Two triangles sharing an edge, a unit square in z = 0, facing +Z. */
const SQUARE = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 0],
    [1, 1, 0],
    [0, 1, 0]
];
const UP = [0, 0, 1];

const facets = (points: number[][]) => [
    {
        vertices: points.slice(0, 3),
        normals: [UP, UP, UP]
    },
    {
        vertices: points.slice(3, 6),
        normals: [UP, UP, UP]
    }
];

const EDGES = [
    {
        id: "JHC",
        edges: [
            {
                id: "JHD",
                vertices: [
                    [0, 0, 0],
                    [1, 0, 0],
                    [1, 1, 0]
                ]
            }
        ]
    }
];

describe("toPreviewMesh", () => {
    it("merges vertices facets share, keeping every triangle", () => {
        const mesh = toPreviewMesh(
            [{ id: "JHC", faces: [{ id: "JHF", facets: facets(SQUARE) }] }],
            EDGES
        );

        expect(mesh.positions).toHaveLength(4 * 3);
        expect(mesh.indices).toHaveLength(6);
        expect(Array.from(mesh.normals.slice(0, 3))).toEqual(UP);
        // A polyline of three points is two segments.
        expect(mesh.edges).toHaveLength(2 * 2 * 3);
    });

    it("reads bodies under `bodies` and points written as objects", () => {
        const asObject = ([x, y, z]: number[]) => ({ x, y, z });
        const faces = {
            bodies: [
                {
                    faces: [
                        {
                            facets: [
                                {
                                    vertices: SQUARE.slice(0, 3).map(asObject),
                                    normal: asObject(UP)
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const mesh = toPreviewMesh(faces, { bodies: EDGES });

        expect(mesh.indices).toHaveLength(3);
        expect(Array.from(mesh.normals.slice(0, 3))).toEqual(UP);
        expect(mesh.edges).toHaveLength(12);
    });

    it("reads corners from a body's index table", () => {
        const mesh = toPreviewMesh(
            [
                {
                    facetPoints: [
                        [0, 0, 0],
                        [1, 0, 0],
                        [0, 1, 0]
                    ],
                    faces: [{ facets: [{ indices: [0, 1, 2] }] }]
                }
            ],
            []
        );

        expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        // No normal sent: the facet's own, from its winding.
        expect(Array.from(mesh.normals.slice(0, 3))).toEqual(UP);
    });

    it("answers an empty mesh for an answer it can't read", () => {
        const mesh = toPreviewMesh({ message: "Not found" }, undefined);

        expect(mesh.indices).toHaveLength(0);
        expect(mesh.edges).toHaveLength(0);
    });
});

describe("the preview mesh format", () => {
    it("round-trips a mesh", () => {
        const mesh = toPreviewMesh(
            [{ faces: [{ facets: facets(SQUARE) }] }],
            EDGES
        );

        const decoded = decodePreviewMesh(encodePreviewMesh(mesh));

        expect(decoded).toEqual(mesh);
    });

    it.each([
        ["too short", new ArrayBuffer(8)],
        ["the wrong magic", new Uint32Array([1, 1, 0, 0, 0]).buffer],
        [
            "an index past its vertices",
            encodePreviewMesh({
                positions: new Float32Array(3),
                normals: new Float32Array(3),
                indices: Uint32Array.from([0, 0, 1]),
                edges: new Float32Array(0)
            })
        ]
    ])("refuses %s", (_name, buffer) => {
        expect(decodePreviewMesh(buffer)).toBeUndefined();
    });
});
