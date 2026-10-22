import { describe, expect, it } from "vitest";
import { type ElementPath } from "../../lib/onshape/path";
import { type OnshapeAssemblyDefinition } from "../../lib/onshape/types";
import {
    partOccurrences,
    placedScrews,
    selectionsByStudio,
    toAssemblyCircularEdges,
    toAssemblyHoles,
    withoutExcluded
} from "./assembly";
import { SelectedEntityType } from "./contract";
import { toTranslation } from "../../lib/onshape/objects/transform";

const ASSEMBLY: ElementPath = {
    documentId: "doc",
    instanceType: "w",
    instanceId: "ws",
    elementId: "asm"
};

const DEFINITION: OnshapeAssemblyDefinition = {
    rootAssembly: {
        features: [],
        instances: [
            {
                id: "plate",
                type: "Part",
                documentId: "doc",
                elementId: "studio",
                partId: "JHD",
                configuration: "default",
                documentMicroversion: "dmv"
            },
            {
                id: "sub",
                type: "Assembly",
                documentId: "lib",
                elementId: "subAsm",
                documentMicroversion: "libmv"
            }
        ],
        occurrences: [
            { path: ["plate"], transform: toTranslation([0, 0, 1]) },
            { path: ["sub"], transform: toTranslation([0, 0, 0]) },
            { path: ["sub", "nested"], transform: toTranslation([1, 0, 0]) }
        ]
    },
    parts: [],
    subAssemblies: [
        {
            features: [],
            documentId: "lib",
            elementId: "subAsm",
            documentMicroversion: "libmv",
            instances: [
                {
                    id: "nested",
                    type: "Part",
                    documentId: "lib",
                    elementId: "libStudio",
                    partId: "JKD",
                    documentVersion: "v1"
                }
            ]
        }
    ]
};

const MICROVERSIONS = new Map([["studio", "emv"]]);

describe("partOccurrences", () => {
    const occurrences = partOccurrences(DEFINITION, ASSEMBLY, MICROVERSIONS);

    it("walks into subassemblies, skipping the subassemblies themselves", () => {
        expect(occurrences.map((each) => each.path)).toEqual([
            ["plate"],
            ["sub", "nested"]
        ]);
    });

    it("pins a part from the workspace by its tab's microversion", () => {
        expect(occurrences[0].source).toEqual({
            path: { ...ASSEMBLY, elementId: "studio" },
            configuration: "default",
            elementMicroversionId: "emv",
            key: "doc|e|emv|studio|default"
        });
    });

    it("pins a part from another document by its version", () => {
        expect(occurrences[1].source.path).toEqual({
            documentId: "lib",
            instanceType: "v",
            instanceId: "v1",
            elementId: "libStudio"
        });
    });

    it("moves holes and picked circular edges into the assembly", () => {
        const [hole] = toAssemblyHoles(
            [
                {
                    faceId: "F",
                    origin: [0, 0, 0],
                    direction: [0, 0, 1],
                    radius: 0.002,
                    start: 0,
                    end: 0.01,
                    closedAtStart: false,
                    closedAtEnd: false,
                    threaded: false,
                    edges: []
                }
            ],
            occurrences[0]
        );
        expect(hole.origin).toEqual([0, 0, 1]);

        const byPath = new Map(
            occurrences.map((each) => [each.path.join("/"), each])
        );
        const picked = [
            {
                occurrencePath: ["plate"],
                entityId: "E1",
                entityType: SelectedEntityType.EDGE
            }
        ];
        expect(selectionsByStudio(picked, byPath)).toEqual(
            new Map([
                ["doc|e|emv|studio|default", { edges: ["E1"], faces: [] }]
            ])
        );
        const [circularEdge] = toAssemblyCircularEdges(
            [
                {
                    id: "E1",
                    partId: "JHD",
                    center: [0, 0, 0],
                    radius: 0.002,
                    normal: [0, 0, 1]
                }
            ],
            picked,
            byPath
        );
        expect(circularEdge.key).toBe("plate|E1");
        expect(circularEdge.center).toEqual([0, 0, 1]);
    });

    it("finds the screws already placed", () => {
        const screws = placedScrews(occurrences, {
            documentId: "lib",
            elementId: "libStudio",
            versionId: "v1"
        });
        expect(screws).toEqual([{ origin: [1, 0, 0], axis: [0, 0, 1] }]);
    });
});

describe("withoutExcluded", () => {
    it("drops excluded circular edges and duplicates", () => {
        const circularEdge = (key: string) => ({
            key,
            occurrencePath: [],
            edgeId: key,
            center: [0, 0, 0] as [number, number, number],
            normal: [0, 0, 1] as [number, number, number],
            radius: 1
        });
        expect(
            withoutExcluded(
                [circularEdge("a"), circularEdge("b"), circularEdge("a")],
                [circularEdge("b")]
            ).map((each) => each.key)
        ).toEqual(["a"]);
    });

    it("leaves a face whole only while none of its holes is skipped", () => {
        const onFace = (key: string, face: string) => ({
            key,
            occurrencePath: ["plate"],
            edgeId: key,
            center: [0, 0, 0] as [number, number, number],
            normal: [0, 0, 1] as [number, number, number],
            radius: 1,
            face
        });
        const left = withoutExcluded(
            [onFace("a", "F"), onFace("b", "F"), onFace("c", "G")],
            [onFace("b", "F")]
        );
        expect(left.map((each) => [each.key, each.face])).toEqual([
            ["a", undefined],
            ["c", "G"]
        ]);
    });
});
