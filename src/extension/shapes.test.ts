import { describe, expect, it } from "vitest";
import {
    parsePreviewRequest,
    type PreviewPart,
    type ScrewShape
} from "./protocol";
import { buildPreviewMesh } from "./shapes";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The lowest and highest of one coordinate across xyz triples. */
function extent(values: Float32Array, axis: number): [number, number] {
    let low = Infinity;
    let high = -Infinity;
    for (let index = axis; index < values.length; index += 3) {
        low = Math.min(low, values[index]);
        high = Math.max(high, values[index]);
    }
    return [low, high];
}

const screwShape: ScrewShape = {
    kind: "screw",
    diameter: 0.005,
    length: 0.02,
    headDiameter: 0.008,
    headHeight: 0.005
};
const screw: PreviewPart = { shape: screwShape, transform: IDENTITY };

describe("buildPreviewMesh", () => {
    it("puts a screw's head above its seat and its shank below", () => {
        const mesh = buildPreviewMesh([screw]);

        const [bottom, top] = extent(mesh.positions, 2);
        expect(bottom).toBeCloseTo(-0.02);
        expect(top).toBeCloseTo(0.005);
        const [, widest] = extent(mesh.positions, 0);
        expect(widest).toBeCloseTo(0.004);
        expect(mesh.normals).toHaveLength(mesh.positions.length);
        expect(mesh.lines.length).toBeGreaterThan(0);
    });

    it("sinks a countersunk head below the seat, within the screw's length", () => {
        const mesh = buildPreviewMesh([
            { ...screw, shape: { ...screwShape, isCountersunk: true } }
        ]);

        const [bottom, top] = extent(mesh.positions, 2);
        expect(bottom).toBeCloseTo(-0.02);
        expect(top).toBeCloseTo(0);
    });

    it("sizes a nut by its flats and a washer by its diameters", () => {
        const nut = buildPreviewMesh([
            {
                shape: { kind: "nut", acrossFlats: 0.01, height: 0.004 },
                transform: IDENTITY
            }
        ]);
        // A flat faces +Y, so the hexagon is across-flats tall and across-corners wide.
        expect(extent(nut.positions, 1)[1]).toBeCloseTo(0.005);
        expect(extent(nut.positions, 0)[1]).toBeCloseTo(
            0.005 / Math.cos(Math.PI / 6)
        );
        expect(extent(nut.positions, 2)).toEqual([0, expect.closeTo(0.004)]);

        const washer = buildPreviewMesh([
            {
                shape: {
                    kind: "washer",
                    innerDiameter: 0.005,
                    outerDiameter: 0.012,
                    thickness: 0.001
                },
                transform: IDENTITY
            }
        ]);
        expect(extent(washer.positions, 0)[1]).toBeCloseTo(0.006);
        const radii = [];
        for (let index = 0; index < washer.positions.length; index += 3) {
            radii.push(
                Math.hypot(washer.positions[index], washer.positions[index + 1])
            );
        }
        expect(Math.min(...radii)).toBeCloseTo(0.0025);
    });

    it("places a part by a row-major transform, turning its normals with it", () => {
        // Turned over about X, then moved to (1, 2, 3).
        const transform = [1, 0, 0, 1, 0, -1, 0, 2, 0, 0, -1, 3, 0, 0, 0, 1];
        const mesh = buildPreviewMesh([{ ...screw, transform }]);

        const [bottom, top] = extent(mesh.positions, 2);
        expect(bottom).toBeCloseTo(3 - 0.005);
        expect(top).toBeCloseTo(3 + 0.02);
        expect(extent(mesh.positions, 0)[1]).toBeCloseTo(1.004);
        expect(extent(mesh.lines, 1)[0]).toBeCloseTo(2 - 0.004);
        for (let index = 0; index < mesh.normals.length; index += 3) {
            const length = Math.hypot(
                mesh.normals[index],
                mesh.normals[index + 1],
                mesh.normals[index + 2]
            );
            expect(length).toBeCloseTo(1);
        }
    });

    it("merges every part into one mesh", () => {
        const one = buildPreviewMesh([screw]);
        const two = buildPreviewMesh([screw, screw]);

        expect(two.positions).toHaveLength(one.positions.length * 2);
        expect(two.lines).toHaveLength(one.lines.length * 2);
    });
});

describe("parsePreviewRequest", () => {
    it("takes a show with well-formed parts", () => {
        const request = {
            source: "frcdesign-preview",
            type: "show",
            parts: [screw]
        };

        expect(parsePreviewRequest(request)).toEqual(request);
    });

    it.each([
        ["another sender's message", { messageName: "SELECTION" }],
        ["an unknown type", { source: "frcdesign-preview", type: "explode" }],
        [
            "a transform that isn't sixteen numbers",
            {
                source: "frcdesign-preview",
                type: "show",
                parts: [{ ...screw, transform: [1, 0, 0] }]
            }
        ],
        [
            "a shape without its dimensions",
            {
                source: "frcdesign-preview",
                type: "show",
                parts: [{ shape: { kind: "nut" }, transform: IDENTITY }]
            }
        ],
        [
            "a length that isn't positive",
            {
                source: "frcdesign-preview",
                type: "show",
                parts: [
                    {
                        shape: { kind: "nut", acrossFlats: -1, height: 1 },
                        transform: IDENTITY
                    }
                ]
            }
        ]
    ])("refuses %s", (_name, data) => {
        expect(parsePreviewRequest(data)).toBeUndefined();
    });
});
