import { describe, expect, it } from "vitest";
import { type ElementPath } from "../../lib/onshape/path";
import { type OnshapeAssemblyDefinition } from "../../lib/onshape/types";
import {
    partOccurrences,
    placedScrews,
    selectionsByStudio,
    toAssemblyCircularEdges,
    toAssemblyHoles,
    toAssemblyPlane,
    withoutExcluded
} from "./assembly";
import { DeclaredPartStatus, SelectedEntityType } from "./contract";
import {
    assemblyConnectors,
    declaredInsertGroups,
    declaredInserts,
    declaredMate,
    type DeclaredProduct,
    planDeclared
} from "./declared";
import { ElementType } from "../../lib/onshape/element-type";
import { ParameterType } from "../configurations/contract";
import { LibraryId } from "../library/library-id";
import { type ScannedConnector } from "./part-scan";
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
                [
                    "doc|e|emv|studio|default",
                    { edges: ["E1"], faces: [], planes: [] }
                ]
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

        const stopFace = {
            ...picked[0],
            entityId: "P1",
            entityType: SelectedEntityType.FACE
        };
        expect(selectionsByStudio([], byPath, [stopFace])).toEqual(
            new Map([
                [
                    "doc|e|emv|studio|default",
                    { edges: [], faces: [], planes: ["P1"] }
                ]
            ])
        );
        const plane = {
            id: "P1",
            partId: "JHD",
            origin: [0, 0, 0.01] as [number, number, number],
            normal: [0, 0, 1] as [number, number, number]
        };
        expect(toAssemblyPlane([plane], stopFace, byPath)).toEqual({
            point: [0, 0, 1.01],
            normal: [0, 0, 1]
        });
        expect(
            toAssemblyPlane([{ ...plane, partId: "other" }], stopFace, byPath)
        ).toBeUndefined();
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
});

describe("declared parts", () => {
    const occurrences = partOccurrences(DEFINITION, ASSEMBLY, MICROVERSIONS);
    const plate = occurrences.find((each) => each.partId === "JHD");
    const connector: ScannedConnector = {
        partId: "JHD",
        connectorId: "Fabc.place.mateConnector",
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        zAxis: [0, 0, 1],
        declaration: {
            version: 1,
            kind: "BEARING",
            documentId: "lib",
            elementId: "bearings",
            configuration: { size: "IN_1_2" },
            name: "1/2 in. Hex Bearing",
            connector: "mateConnector",
            spec: {}
        }
    };
    const product: DeclaredProduct = {
        insertableId: "bearing-studio",
        libraryId: LibraryId.FRC_DESIGN_LIB,
        documentId: "lib",
        versionId: "libv",
        elementId: "bearings",
        elementType: ElementType.PART_STUDIO,
        parameters: [
            {
                id: "size",
                name: "Size",
                type: ParameterType.ENUM,
                default: "IN_3_8",
                options: [
                    { id: "IN_3_8", name: "3/8 in." },
                    { id: "IN_1_2", name: "1/2 in." }
                ],
                optionConditions: []
            }
        ],
        mateConnectorId: "Fset.mateConnector"
    };
    const connectors = assemblyConnectors(
        occurrences,
        new Map([[plate?.source.key ?? "", [connector]]])
    );
    const products = new Map([["lib|bearings", product]]);

    it("moves each connector into the assembly with its part", () => {
        expect(connectors).toEqual([
            expect.objectContaining({
                key: "plate|Fabc.place.mateConnector",
                hostPath: ["plate"],
                origin: [0, 0, 1],
                zAxis: [0, 0, 1]
            })
        ]);
    });

    it("inserts the library's part on the connector and fastens it there, the host second", () => {
        const [plan] = planDeclared(connectors, products, occurrences);
        expect(plan.status).toBe(DeclaredPartStatus.READY);
        const [insert] = declaredInserts([plan]);
        const [group] = declaredInsertGroups([insert]);
        expect(group.instances).toEqual([
            expect.objectContaining({
                documentId: "lib",
                versionId: "libv",
                elementId: "bearings",
                configuration: "size=IN_1_2"
            })
        ]);
        expect(group.transform.slice(0, 12)).toEqual([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1
        ]);
        expect(JSON.stringify(declaredMate(insert, ["new"]))).toContain(
            JSON.stringify([
                {
                    btType: "BTMPartStudioMateConnectorQuery-1324",
                    featureId: "Fset.mateConnector",
                    path: ["new"]
                },
                {
                    btType: "BTMPartStudioMateConnectorQuery-1324",
                    featureId: "Fabc.place.mateConnector",
                    path: ["plate"]
                }
            ])
        );
    });

    it("says why a part can't be placed", () => {
        const reasons = (
            declaration: Partial<ScannedConnector["declaration"]>,
            found = products
        ) =>
            planDeclared(
                assemblyConnectors(
                    occurrences,
                    new Map([
                        [
                            plate?.source.key ?? "",
                            [
                                {
                                    ...connector,
                                    declaration: {
                                        ...connector.declaration,
                                        ...declaration
                                    }
                                }
                            ]
                        ]
                    ])
                ),
                found,
                occurrences
            ).map((plan) => plan.reason);
        expect(reasons({}, new Map())).toEqual([
            "FRCDesign's library doesn't have this part."
        ]);
        expect(reasons({ configuration: { size: "IN_5_8" } })).toEqual([
            "This part's configuration isn't in the library."
        ]);
        expect(
            reasons(
                {},
                new Map([
                    ["lib|bearings", { ...product, mateConnectorId: undefined }]
                ])
            )
        ).toEqual(["This part has no mate connector."]);
        expect(
            reasons({
                nut: {
                    documentId: "lib",
                    elementId: "nuts",
                    configuration: { type: "NYLOCK" },
                    name: "#10-32 Nut"
                }
            })
        ).toEqual(["FRCDesign's library doesn't have this screw's nut."]);
    });

    it("flips a part to the far rim of its hole, and places only the parts chosen", () => {
        const flippable = assemblyConnectors(
            occurrences,
            new Map([
                [
                    plate?.source.key ?? "",
                    [
                        {
                            ...connector,
                            flip: { edgeId: "farRim", origin: [0, 0, -0.25] }
                        },
                        { ...connector, connectorId: "Fother.mateConnector" }
                    ]
                ]
            ])
        );
        const plans = planDeclared(flippable, products, occurrences, {
            parts: [flippable[0].key],
            flipped: [flippable[0].key]
        });
        expect(plans).toHaveLength(1);
        const [plan] = plans;
        expect(plan.isFlipped).toBe(true);
        const [insert] = declaredInserts([plan]);
        const [group] = declaredInsertGroups([insert]);
        // On the far rim, its Z turned back into the hole; `+ 0` makes -0 0
        expect(group.transform.slice(0, 12).map((each) => each + 0)).toEqual([
            1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0.75
        ]);
        const mate = JSON.stringify(declaredMate(insert, ["new"]));
        expect(mate).toContain('"deterministicIds":["farRim"]');
        expect(mate).toContain('"featureId":"Fset.mateConnector"');
    });

    it("leaves a connector whose part is already on it", () => {
        const placed = [
            ...occurrences,
            {
                ...occurrences[0],
                path: ["bearing"],
                documentId: "lib",
                elementId: "bearings",
                transform: toTranslation([0, 0, 1])
            }
        ];
        expect(
            planDeclared(connectors, products, placed).map(
                (plan) => plan.status
            )
        ).toEqual([DeclaredPartStatus.PLACED]);
    });
});
