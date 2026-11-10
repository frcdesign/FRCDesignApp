/**
 * What Onshape answered for a test document with problems planted in it
 * (2026-11-10), cut to the fields the design check reads.
 */
import { ElementType } from "@backend/lib/onshape/element-type";
import type {
    AssemblySnapshot,
    PartStudioSnapshot
} from "@backend/features/design-check/snapshot";

/**
 * The Origin Cube second, and yellow for it; Sketches 2, 4, 6 and 7
 * under-defined and Sketch 3 over-defined; Extrude 1 red; Extrude 2 missing a
 * selection; Sketch 5 suppressed; the rollback bar at the end; Parts 2 and 3
 * with no material or part number.
 */
export const CAPTURED_PART_STUDIO: PartStudioSnapshot = {
    elementType: ElementType.PART_STUDIO,
    features: {
        features: [
            {
                featureType: "newSketch",
                featureId: "FXmHyN37VOudwGR_0",
                name: "Sketch 1",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "myFeature",
                featureId: "Fo9YxKzeEfB4v3Y_0",
                name: "#_name",
                suppressed: false,
                namespace:
                    "d321c197a842fc5f1a29e6621::v2565d082d3d8c8e592d34548::ec66db2b954da7f29d438195a::m47bccffc590fcc453c6e360f"
            },
            {
                featureType: "newSketch",
                featureId: "FzKSHQN3AEjktja_1",
                name: "Sketch 2",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "newSketch",
                featureId: "Ft4L8qxUvRHMnoa_1",
                name: "Sketch 3",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "extrude",
                featureId: "FqGK6Q0t1g3GRNQ_1",
                name: "Extrude 1",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "newSketch",
                featureId: "F512UKjii2hHrEz_1",
                name: "Sketch 4",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "extrude",
                featureId: "FiBoXckfOmUb2Dg_1",
                name: "Extrude 2",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "newSketch",
                featureId: "FN6Zx5HfIn5CgJZ_1",
                name: "Sketch 5",
                suppressed: true,
                namespace: ""
            },
            {
                featureType: "extrude",
                featureId: "F7uXatEWaOFAxEi_1",
                name: "Extrude 3",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "extrude",
                featureId: "FXXccICOX3b1i6w_2",
                name: "Extrude 4",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "newSketch",
                featureId: "FrFpzPobHzSf0EH_1",
                name: "Sketch 6",
                suppressed: false,
                namespace: ""
            },
            {
                featureType: "newSketch",
                featureId: "F8cleltaVQgZKHw_1",
                name: "Sketch 7",
                suppressed: false,
                namespace: ""
            }
        ],
        featureStates: {
            FXmHyN37VOudwGR_0: {
                featureStatus: "OK"
            },
            Fo9YxKzeEfB4v3Y_0: {
                featureStatus: "WARNING"
            },
            FzKSHQN3AEjktja_1: {
                featureStatus: "OK"
            },
            Ft4L8qxUvRHMnoa_1: {
                featureStatus: "WARNING"
            },
            FqGK6Q0t1g3GRNQ_1: {
                featureStatus: "ERROR"
            },
            F512UKjii2hHrEz_1: {
                featureStatus: "OK"
            },
            FiBoXckfOmUb2Dg_1: {
                featureStatus: "OK"
            },
            FN6Zx5HfIn5CgJZ_1: {
                featureStatus: "OK"
            },
            F7uXatEWaOFAxEi_1: {
                featureStatus: "OK"
            },
            FXXccICOX3b1i6w_2: {
                featureStatus: "OK"
            },
            FrFpzPobHzSf0EH_1: {
                featureStatus: "OK"
            },
            F8cleltaVQgZKHw_1: {
                featureStatus: "OK"
            }
        },
        rollbackIndex: 12
    },
    sketches: {
        sketches: [
            {
                featureId: "FrFpzPobHzSf0EH_1",
                sketchSolveStatus: "UNDERDEFINED"
            },
            {
                featureId: "Ft4L8qxUvRHMnoa_1",
                sketchSolveStatus: "OVERDEFINED"
            },
            {
                featureId: "F512UKjii2hHrEz_1",
                sketchSolveStatus: "UNDERDEFINED"
            },
            {
                featureId: "FzKSHQN3AEjktja_1",
                sketchSolveStatus: "UNDERDEFINED"
            },
            {
                featureId: "FXmHyN37VOudwGR_0",
                sketchSolveStatus: "WELL_DEFINED"
            },
            {
                featureId: "F8cleltaVQgZKHw_1",
                sketchSolveStatus: "UNDERDEFINED"
            }
        ]
    },
    parts: [
        {
            partId: "JJD",
            name: "Origin Cube",
            bodyType: "solid",
            material: {
                displayName: "Origin Cube Material"
            },
            partNumber: null,
            description: null
        },
        {
            partId: "JmD",
            name: "Part 2",
            bodyType: "solid",
            partNumber: null,
            description: null
        },
        {
            partId: "JnD",
            name: "Part 3",
            bodyType: "solid",
            partNumber: null,
            description: null
        },
        {
            partId: "JoD",
            name: "Part 4",
            bodyType: "solid",
            material: {
                displayName: "Polycarbonate"
            },
            partNumber: "123",
            description: null
        }
    ]
};

/**
 * The Origin Cube fastened to the origin and grouped with Part 2 <1>, which
 * Part 2 <2> patterns; Part 3 <1> fixed; Part 4 <1> and Part 1 <2> unmated;
 * Part 2 <3> held only by a suppressed fasten; Part 5 <1> inserted from a part
 * since deleted, and Part 1 <1> from a tab since deleted. An inserted sketch is
 * in the document, and left out of the definition.
 */
export const CAPTURED_ASSEMBLY: AssemblySnapshot = {
    elementType: ElementType.ASSEMBLY,
    definition: {
        rootAssembly: {
            instances: [
                {
                    id: "Mdxh3o0oikeMdkZcB",
                    type: "Part",
                    name: "Origin Cube <1>",
                    suppressed: false,
                    partId: "JJD"
                },
                {
                    id: "Mg5o57p3J6fUhrFTG",
                    type: "Part",
                    name: "Part 2 <1>",
                    suppressed: false,
                    partId: "JmD"
                },
                {
                    id: "IVKZk7DhEmrNqZ7cf",
                    type: "Part",
                    name: "Part 2 <2>",
                    suppressed: false,
                    partId: "JmD"
                },
                {
                    id: "MczPxJ5nqG0e9D5EZ",
                    type: "Part",
                    name: "Part 3 <1>",
                    suppressed: false,
                    partId: "JnD"
                },
                {
                    id: "MfVh/f1qhxW+duztV",
                    type: "Part",
                    name: "Part 4 <1>",
                    suppressed: false,
                    partId: "JoD"
                },
                {
                    id: "MkihG1jaczYsVFGWN",
                    type: "Part",
                    name: "Part 5 <1>",
                    suppressed: false,
                    partId: ""
                },
                {
                    id: "MyVldukVFexowNChw",
                    type: "Part",
                    name: "Part 2 <3>",
                    suppressed: false,
                    partId: "JmD"
                },
                {
                    id: "MGLhB6zXZpAJ3xUUn",
                    type: "Part",
                    name: "Part 3 <2>",
                    suppressed: false,
                    partId: "JnD"
                },
                {
                    id: "MpCko581ilk3iyFPK",
                    name: "Part 1 <1>"
                },
                {
                    id: "M34AHWLzF6t1e1jHC",
                    type: "Part",
                    name: "Part 1 <2>",
                    suppressed: false,
                    partId: "JHD"
                }
            ],
            occurrences: [
                {
                    path: ["M34AHWLzF6t1e1jHC"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MGLhB6zXZpAJ3xUUn"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MczPxJ5nqG0e9D5EZ"],
                    transform: [],
                    fixed: true
                },
                {
                    path: ["Mdxh3o0oikeMdkZcB"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MfVh/f1qhxW+duztV"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["Mg5o57p3J6fUhrFTG"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MkihG1jaczYsVFGWN"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MpCko581ilk3iyFPK"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["MyVldukVFexowNChw"],
                    transform: [],
                    fixed: false
                },
                {
                    path: ["IVKZk7DhEmrNqZ7cf"],
                    transform: [],
                    fixed: false
                }
            ],
            features: [
                {
                    id: "Ms4PAUfjz14+S7Wu1",
                    featureType: "mate",
                    suppressed: false,
                    featureData: {
                        name: "Fastened 1",
                        matedEntities: [
                            {
                                matedOccurrence: ["Mdxh3o0oikeMdkZcB"]
                            },
                            {
                                matedOccurrence: []
                            }
                        ]
                    }
                },
                {
                    id: "MVNrBKTLTuXd1MK8A",
                    featureType: "mateGroup",
                    suppressed: false,
                    featureData: {
                        name: "Group 1",
                        occurrences: [
                            {
                                occurrence: ["Mdxh3o0oikeMdkZcB"]
                            },
                            {
                                occurrence: ["Mg5o57p3J6fUhrFTG"]
                            }
                        ]
                    }
                },
                {
                    id: "MpF/uMOr0ROzuSef4",
                    featureType: "mate",
                    suppressed: true,
                    featureData: {
                        name: "Fastened 2",
                        matedEntities: [
                            {
                                matedOccurrence: ["MyVldukVFexowNChw"]
                            },
                            {
                                matedOccurrence: ["MczPxJ5nqG0e9D5EZ"]
                            }
                        ]
                    }
                },
                {
                    id: "My7RUD9cOk1UXXDJw",
                    featureType: "mate",
                    suppressed: false,
                    featureData: {
                        name: "Fastened 3",
                        matedEntities: [
                            {
                                matedOccurrence: ["MGLhB6zXZpAJ3xUUn"]
                            },
                            {
                                matedOccurrence: ["Mdxh3o0oikeMdkZcB"]
                            }
                        ]
                    }
                }
            ],
            patterns: [
                {
                    suppressed: false,
                    seedToPatternInstances: {
                        Mg5o57p3J6fUhrFTG: ["IVKZk7DhEmrNqZ7cf"]
                    }
                }
            ]
        },
        parts: [],
        subAssemblies: []
    },
    features: {
        features: [
            {
                featureType: "mate",
                featureId: "Ms4PAUfjz14+S7Wu1",
                name: "Fastened 1",
                suppressed: false
            },
            {
                featureType: "mateGroup",
                featureId: "MVNrBKTLTuXd1MK8A",
                name: "Group 1",
                suppressed: false
            },
            {
                featureType: "mate",
                featureId: "MpF/uMOr0ROzuSef4",
                name: "Fastened 2",
                suppressed: true
            },
            {
                featureType: "mate",
                featureId: "My7RUD9cOk1UXXDJw",
                name: "Fastened 3",
                suppressed: false
            },
            {
                featureType: "pattern",
                featureId: "Md8gIOr+UAcYt+83m",
                name: "Linear pattern 1",
                suppressed: false
            }
        ],
        featureStates: {
            "Ms4PAUfjz14+S7Wu1": {
                featureStatus: "OK"
            },
            MVNrBKTLTuXd1MK8A: {
                featureStatus: "OK"
            },
            "MpF/uMOr0ROzuSef4": {
                featureStatus: "OK"
            },
            My7RUD9cOk1UXXDJw: {
                featureStatus: "OK"
            },
            "Md8gIOr+UAcYt+83m": {
                featureStatus: "OK"
            }
        }
    }
};
