import { describe, expect, it } from "vitest";
import { ElementType } from "../../lib/onshape/element-type";
import type {
    OnshapeAssemblyFeature,
    OnshapeAssemblyInstance,
    OnshapeFeatureListResponse,
    OnshapePart,
    OnshapeSketchSolveStatus
} from "../../lib/onshape/types";
import {
    CAPTURED_ASSEMBLY,
    CAPTURED_PART_STUDIO
} from "../../../__test_utils__/design-check-captures";
import { checkDesign } from "./checks";
import { DesignIssueType } from "./contract";
import type { AssemblySnapshot, PartStudioSnapshot } from "./snapshot";

type Feature = OnshapeFeatureListResponse["features"][number];
type FeatureStatus = "OK" | "INFO" | "WARNING" | "ERROR";

const CUBE_DOCUMENT_ID = "321c197a842fc5f1a29e6621";

function originCube(overrides: Partial<Feature> = {}): Feature {
    return {
        featureType: "myFeature",
        featureId: "Fcube",
        // Onshape sends the name template unfilled.
        name: "#_name",
        suppressed: false,
        namespace: `d${CUBE_DOCUMENT_ID}::v2565d082d3d8c8e592d34548::ec66db2b954da7f29d438195a::m0123456789abcdef01234567`,
        ...overrides
    };
}

function sketch(featureId: string, name = featureId): Feature {
    return { featureType: "newSketch", featureId, name, suppressed: false };
}

function extrude(featureId: string, overrides: Partial<Feature> = {}): Feature {
    return {
        featureType: "extrude",
        featureId,
        name: featureId,
        suppressed: false,
        ...overrides
    };
}

/** One selection box, holding a pick per list of the ids it resolves to. */
function picks(
    ...resolved: string[][]
): NonNullable<Feature["parameters"]>[number] {
    return {
        btType: "BTMParameterQueryList-148",
        parameterId: "entities",
        queries: resolved.map((deterministicIds) => ({
            btType: "BTMIndividualQuery-138",
            deterministicIds
        }))
    };
}

function part(
    partId: string,
    overrides: Partial<OnshapePart> = {}
): OnshapePart {
    return {
        partId,
        name: `Part ${partId}`,
        bodyType: "solid",
        material: { displayName: "Aluminum - 6061" },
        partNumber: `8033-${partId}`,
        description: "A good part",
        ...overrides
    };
}

function partStudio(options: {
    features: Feature[];
    statuses?: Record<string, FeatureStatus>;
    /** Undefined when Onshape couldn't list the sketches. */
    sketchStatuses?: Record<string, OnshapeSketchSolveStatus> | null;
    parts?: OnshapePart[];
    rollbackIndex?: number;
}): PartStudioSnapshot {
    const featureStates = Object.fromEntries(
        options.features.map((feature) => [
            feature.featureId,
            { featureStatus: options.statuses?.[feature.featureId] ?? "OK" }
        ])
    );
    const sketches =
        options.sketchStatuses === null
            ? undefined
            : {
                  sketches: Object.entries(options.sketchStatuses ?? {}).map(
                      ([featureId, sketchSolveStatus]) => ({
                          featureId,
                          sketchSolveStatus
                      })
                  )
              };
    return {
        elementType: ElementType.PART_STUDIO,
        features: {
            features: options.features,
            featureStates,
            rollbackIndex: options.rollbackIndex
        },
        sketches,
        parts: options.parts ?? []
    };
}

function instance(
    id: string,
    overrides: Partial<OnshapeAssemblyInstance> = {}
): OnshapeAssemblyInstance {
    return {
        id,
        name: `${id} <1>`,
        type: "Part",
        suppressed: false,
        ...overrides
    };
}

function fasten(id: string, ...ends: string[][]): OnshapeAssemblyFeature {
    return {
        id,
        featureType: "mate",
        suppressed: false,
        featureData: {
            name: id,
            matedEntities: ends.map((end) => ({ matedOccurrence: end }))
        }
    };
}

function assembly(options: {
    instances: OnshapeAssemblyInstance[];
    fixed?: string[];
    mates?: OnshapeAssemblyFeature[];
    patterns?: { seedToPatternInstances: Record<string, string[]> }[];
    statuses?: Record<string, FeatureStatus>;
}): AssemblySnapshot {
    const mates = options.mates ?? [];
    return {
        elementType: ElementType.ASSEMBLY,
        definition: {
            rootAssembly: {
                instances: options.instances,
                occurrences: options.instances.map((each) => ({
                    path: [each.id],
                    transform: [],
                    fixed: options.fixed?.includes(each.id) ?? false
                })),
                features: mates,
                patterns: options.patterns ?? []
            },
            parts: [],
            subAssemblies: []
        },
        features: {
            features: mates.map((mate) => ({
                featureId: mate.id,
                name: mate.featureData?.name ?? mate.id,
                featureType: mate.featureType,
                suppressed: mate.suppressed ?? false
            })),
            featureStates: Object.fromEntries(
                mates.map((mate) => [
                    mate.id,
                    { featureStatus: options.statuses?.[mate.id] ?? "OK" }
                ])
            )
        }
    };
}

function types(snapshot: PartStudioSnapshot | AssemblySnapshot) {
    return checkDesign(snapshot).issues.map((issue) => issue.type);
}

describe("a Part Studio", () => {
    it("that follows every practice has no issues", () => {
        const snapshot = partStudio({
            features: [originCube(), sketch("S1"), extrude("E1")],
            sketchStatuses: { S1: "WELL_DEFINED" },
            parts: [part("JHD")]
        });

        expect(checkDesign(snapshot)).toEqual({
            issues: [],
            sketchStatusUnknown: false
        });
    });

    it("flags under- and over-defined sketches", () => {
        const snapshot = partStudio({
            features: [originCube(), sketch("S1"), sketch("S2"), sketch("S3")],
            sketchStatuses: {
                S1: "UNDERDEFINED",
                S2: "OVERDEFINED",
                S3: "WELL_DEFINED"
            }
        });

        expect(
            checkDesign(snapshot).issues.map((issue) => [
                issue.type,
                issue.featureId
            ])
        ).toEqual([
            [DesignIssueType.SKETCH_UNDERDEFINED, "S1"],
            [DesignIssueType.SKETCH_OVERDEFINED, "S2"]
        ]);
    });

    it("reports an over-defined sketch once, not also as a yellow feature", () => {
        const snapshot = partStudio({
            features: [originCube(), sketch("S1")],
            statuses: { S1: "WARNING" },
            sketchStatuses: { S1: "OVERDEFINED" }
        });

        expect(types(snapshot)).toEqual([DesignIssueType.SKETCH_OVERDEFINED]);
    });

    it("skips a suppressed sketch's definition", () => {
        const snapshot = partStudio({
            features: [originCube(), { ...sketch("S1"), suppressed: true }],
            sketchStatuses: { S1: "UNDERDEFINED" }
        });

        expect(types(snapshot)).toEqual([DesignIssueType.FEATURE_SUPPRESSED]);
    });

    it("says when no sketch's status came back, and still finds a yellow sketch", () => {
        const snapshot = partStudio({
            features: [originCube(), sketch("S1")],
            statuses: { S1: "WARNING" },
            sketchStatuses: null
        });

        const result = checkDesign(snapshot);

        expect(result.issues.map((issue) => issue.type)).toEqual([
            DesignIssueType.FEATURE_WARNING
        ]);
        expect(result.sketchStatusUnknown).toBe(true);
    });

    it("finds everything planted in a captured Part Studio", () => {
        const result = checkDesign(CAPTURED_PART_STUDIO);

        expect(result.sketchStatusUnknown).toBe(false);
        expect(
            result.issues.map((issue) => [issue.type, issue.subject])
        ).toEqual([
            [DesignIssueType.SKETCH_UNDERDEFINED, "Sketch 2"],
            [DesignIssueType.SKETCH_OVERDEFINED, "Sketch 3"],
            [DesignIssueType.SKETCH_UNDERDEFINED, "Sketch 4"],
            [DesignIssueType.SKETCH_UNDERDEFINED, "Sketch 6"],
            [DesignIssueType.SKETCH_UNDERDEFINED, "Sketch 7"],
            [DesignIssueType.FEATURE_ERROR, "Extrude 1"],
            [DesignIssueType.FEATURE_WARNING, "Extrude 2"],
            [DesignIssueType.PART_NO_MATERIAL, "Part 2"],
            [DesignIssueType.PART_NO_MATERIAL, "Part 3"],
            [DesignIssueType.ORIGIN_CUBE_NOT_FIRST, "Origin Cube"],
            [DesignIssueType.FEATURE_SUPPRESSED, "Sketch 5"],
            [DesignIssueType.PART_NO_PART_NUMBER, "Part 2"],
            [DesignIssueType.PART_NO_DESCRIPTION, "Part 2"],
            [DesignIssueType.PART_NO_PART_NUMBER, "Part 3"],
            [DesignIssueType.PART_NO_DESCRIPTION, "Part 3"],
            [DesignIssueType.PART_NO_DESCRIPTION, "Part 4"]
        ]);
    });

    it("needs an Origin Cube", () => {
        expect(types(partStudio({ features: [extrude("E1")] }))).toEqual([
            DesignIssueType.ORIGIN_CUBE_MISSING
        ]);
    });

    it("knows the Origin Cube by its FeatureScript, renamed or not", () => {
        const renamed = originCube({ name: "Ground" });

        expect(types(partStudio({ features: [renamed] }))).toEqual([]);
    });

    it("knows a renamed copy of the Origin Cube by its name", () => {
        const copy = originCube({
            name: "Origin Cube 1",
            namespace: "d0123456789abcdef01234567::v1::e2::m3"
        });

        expect(types(partStudio({ features: [copy] }))).toEqual([]);
    });

    it("doesn't take a built-in feature or a part named for the cube for it", () => {
        const snapshot = partStudio({
            features: [
                extrude("E1", { name: "Origin Cube Mount", suppressed: true })
            ],
            parts: [
                part("M", { name: "Origin Cube Mount", material: undefined })
            ]
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.PART_NO_MATERIAL,
            DesignIssueType.ORIGIN_CUBE_MISSING,
            DesignIssueType.FEATURE_SUPPRESSED
        ]);
    });

    it("still reports a misplaced Origin Cube that is red", () => {
        const snapshot = partStudio({
            features: [extrude("E1"), originCube()],
            statuses: { Fcube: "ERROR" }
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.FEATURE_ERROR,
            DesignIssueType.ORIGIN_CUBE_NOT_FIRST
        ]);
    });

    it("doesn't miss sketch status for sketches only below the rollback bar", () => {
        const snapshot = partStudio({
            features: [originCube(), extrude("E1"), sketch("S1")],
            sketchStatuses: {},
            rollbackIndex: 2
        });

        expect(checkDesign(snapshot).sketchStatusUnknown).toBe(false);
    });

    it("doesn't take a sketch named Origin Cube for it", () => {
        const snapshot = partStudio({
            features: [sketch("S1", "Origin Cube sketch")],
            sketchStatuses: { S1: "WELL_DEFINED" }
        });

        expect(types(snapshot)).toEqual([DesignIssueType.ORIGIN_CUBE_MISSING]);
    });

    it("wants the Origin Cube first, and says where it is", () => {
        const snapshot = partStudio({
            features: [extrude("E1"), extrude("E2"), originCube()]
        });

        expect(checkDesign(snapshot).issues).toEqual([
            {
                type: DesignIssueType.ORIGIN_CUBE_NOT_FIRST,
                subject: "Origin Cube",
                featureId: "Fcube",
                count: 3
            }
        ]);
    });

    it("reports a misplaced Origin Cube once, not also as the warning it raises", () => {
        const snapshot = partStudio({
            features: [extrude("E1"), originCube()],
            statuses: { Fcube: "WARNING" }
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.ORIGIN_CUBE_NOT_FIRST
        ]);
    });

    it("still reports a yellow Origin Cube that is first", () => {
        const snapshot = partStudio({
            features: [originCube()],
            statuses: { Fcube: "WARNING" }
        });

        expect(types(snapshot)).toEqual([DesignIssueType.FEATURE_WARNING]);
    });

    it("reports a suppressed Origin Cube as itself, not as any suppressed feature", () => {
        const snapshot = partStudio({
            features: [originCube({ suppressed: true })]
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.ORIGIN_CUBE_SUPPRESSED
        ]);
    });

    it("flags red, yellow and suppressed features", () => {
        const snapshot = partStudio({
            features: [
                originCube(),
                extrude("E1", { suppressed: true }),
                extrude("E2"),
                extrude("E3"),
                extrude("E4")
            ],
            statuses: { E2: "WARNING", E3: "ERROR", E4: "INFO" }
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.FEATURE_WARNING,
            DesignIssueType.FEATURE_ERROR,
            DesignIssueType.FEATURE_SUPPRESSED
        ]);
    });

    it("flags a rollback bar above the end, counting what it hides", () => {
        const features = [originCube(), extrude("E1"), extrude("E2")];

        expect(
            checkDesign(partStudio({ features, rollbackIndex: 1 })).issues
        ).toEqual([{ type: DesignIssueType.ROLLBACK_NOT_AT_END, count: 2 }]);
        // Onshape sends the feature count with the bar at the end.
        expect(types(partStudio({ features, rollbackIndex: 3 }))).toEqual([]);
        expect(types(partStudio({ features, rollbackIndex: -1 }))).toEqual([]);
    });

    it("calls a feature yellow once one of a box's picks is gone", () => {
        const snapshot = partStudio({
            features: [
                originCube(),
                extrude("lost", { parameters: [picks(["JlC"], [])] }),
                extrude("whole", { parameters: [picks(["JmC"], ["JnC"])] })
            ]
        });

        expect(
            checkDesign(snapshot).issues.map((issue) => [
                issue.type,
                issue.featureId
            ])
        ).toEqual([[DesignIssueType.FEATURE_WARNING, "lost"]]);
    });

    it("looks for lost picks only where Onshape would show them", () => {
        const lost = [picks(["JlC"], [])];
        const snapshot = partStudio({
            features: [
                originCube(),
                // A sketch's plane on Top never resolves.
                { ...sketch("onTop"), parameters: [picks([])] },
                extrude("red", { parameters: lost }),
                extrude("off", { parameters: lost, suppressed: true }),
                extrude("rolledBack", { parameters: lost })
            ],
            statuses: { red: "ERROR" },
            sketchStatuses: { onTop: "WELL_DEFINED" },
            rollbackIndex: 4
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.FEATURE_ERROR,
            DesignIssueType.FEATURE_SUPPRESSED,
            DesignIssueType.ROLLBACK_NOT_AT_END
        ]);
    });

    it("flags a part with no material, part number or description", () => {
        const snapshot = partStudio({
            features: [originCube()],
            parts: [
                part("A", {
                    material: undefined,
                    partNumber: " ",
                    description: undefined
                })
            ]
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.PART_NO_MATERIAL,
            DesignIssueType.PART_NO_PART_NUMBER,
            DesignIssueType.PART_NO_DESCRIPTION
        ]);
    });

    it("leaves the Origin Cube's part and non-solid bodies alone", () => {
        const snapshot = partStudio({
            features: [originCube()],
            parts: [
                part("C", {
                    name: "Cube of All Time",
                    material: undefined,
                    partNumber: undefined
                }),
                part("S", { bodyType: "sheet", material: undefined })
            ]
        });

        expect(types(snapshot)).toEqual([]);
    });
});

describe("an Assembly", () => {
    it("that is fully mated has no issues", () => {
        const snapshot = assembly({
            instances: [instance("cube"), instance("plate")],
            mates: [
                fasten("M1", [], ["cube"]),
                fasten("M2", ["cube"], ["plate"])
            ]
        });

        expect(types(snapshot)).toEqual([]);
    });

    it("flags fixed and floating instances", () => {
        const snapshot = assembly({
            instances: [instance("cube"), instance("plate"), instance("loose")],
            fixed: ["cube"],
            mates: [fasten("M1", ["cube"], ["plate"])]
        });

        expect(
            checkDesign(snapshot).issues.map((issue) => [
                issue.type,
                issue.instanceId
            ])
        ).toEqual([
            [DesignIssueType.INSTANCE_FIXED, "cube"],
            [DesignIssueType.INSTANCE_FLOATING, "loose"]
        ]);
    });

    it("counts grouped and patterned instances as held", () => {
        const group: OnshapeAssemblyFeature = {
            id: "G1",
            featureType: "mateGroup",
            featureData: {
                name: "Group 1",
                occurrences: [{ occurrence: ["a"] }, { occurrence: ["b"] }]
            }
        };
        const snapshot = assembly({
            instances: [instance("a"), instance("b"), instance("copy")],
            mates: [group],
            patterns: [{ seedToPatternInstances: { b: ["copy"] } }]
        });

        expect(types(snapshot)).toEqual([]);
    });

    it("doesn't count a suppressed pattern's copies as held", () => {
        const snapshot = assembly({
            instances: [instance("a"), instance("copy")],
            mates: [fasten("M1", [], ["a"])],
            patterns: [{ seedToPatternInstances: { a: ["copy"] } }]
        });
        snapshot.definition.rootAssembly.patterns = [
            { suppressed: true, seedToPatternInstances: { a: ["copy"] } }
        ];

        expect(types(snapshot)).toEqual([DesignIssueType.INSTANCE_FLOATING]);
    });

    it("names the part an instance shows, unless the part is gone", () => {
        const snapshot = assembly({
            instances: [
                instance("plate", { partId: "JHD" }),
                instance("gone", { partId: "" })
            ]
        });

        expect(
            checkDesign(snapshot).issues.map((issue) => [
                issue.instanceId,
                issue.partId
            ])
        ).toEqual([
            ["plate", "JHD"],
            ["gone", undefined]
        ]);
    });

    it("calls a part instance broken once its part is gone, and not floating", () => {
        const snapshot = assembly({
            instances: [instance("gone", { partId: "" })]
        });

        expect(types(snapshot)).toEqual([DesignIssueType.INSTANCE_BROKEN]);
    });

    it("finds everything planted in a captured Assembly", () => {
        expect(
            checkDesign(CAPTURED_ASSEMBLY).issues.map((issue) => [
                issue.type,
                issue.subject
            ])
        ).toEqual([
            [DesignIssueType.INSTANCE_FIXED, "Part 3 <1>"],
            [DesignIssueType.INSTANCE_FLOATING, "Part 4 <1>"],
            [DesignIssueType.INSTANCE_BROKEN, "Part 5 <1>"],
            [DesignIssueType.INSTANCE_FLOATING, "Part 2 <3>"],
            [DesignIssueType.INSTANCE_BROKEN, "Part 1 <1>"],
            [DesignIssueType.INSTANCE_FLOATING, "Part 1 <2>"],
            [DesignIssueType.FEATURE_SUPPRESSED, "Fastened 2"]
        ]);
    });

    it("reports a suppressed mate named for the Origin Cube, and one with no name", () => {
        const suppressed = (
            id: string,
            name: string
        ): OnshapeAssemblyFeature => {
            const mate = fasten(id, [], ["a"]);
            return {
                ...mate,
                suppressed: true,
                featureData: { ...mate.featureData, name }
            };
        };
        const snapshot = assembly({
            instances: [instance("a")],
            mates: [
                fasten("M1", [], ["a"]),
                suppressed("M2", "Origin Cube Fasten"),
                suppressed("M3", "")
            ]
        });

        expect(
            checkDesign(snapshot).issues.map((issue) => [
                issue.type,
                issue.subject
            ])
        ).toEqual([
            [DesignIssueType.FEATURE_SUPPRESSED, "Origin Cube Fasten"],
            [DesignIssueType.FEATURE_SUPPRESSED, "M3"]
        ]);
    });

    it("ignores suppressed mates and suppressed instances", () => {
        const snapshot = assembly({
            instances: [instance("a"), instance("gone", { suppressed: true })],
            mates: [{ ...fasten("M1", ["a"], ["gone"]), suppressed: true }]
        });

        expect(types(snapshot)).toEqual([
            DesignIssueType.INSTANCE_FLOATING,
            DesignIssueType.FEATURE_SUPPRESSED
        ]);
    });

    it("calls an instance broken once Onshape sends only its name and id", () => {
        const snapshot = assembly({
            instances: [{ id: "gone", name: "Gone <1>" }]
        });

        expect(types(snapshot)).toEqual([DesignIssueType.INSTANCE_BROKEN]);
    });

    it("flags a red mate", () => {
        const snapshot = assembly({
            instances: [instance("a"), instance("b")],
            mates: [fasten("M1", ["a"], ["b"])],
            statuses: { M1: "ERROR" }
        });

        expect(types(snapshot)).toEqual([DesignIssueType.FEATURE_ERROR]);
    });
});
