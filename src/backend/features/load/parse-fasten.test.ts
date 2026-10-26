import { describe, expect, it } from "vitest";

import { MateLocation } from "../library/insertables/fasten";
import {
    parseFastenInfoFromPartStudio,
    parseFastenInfoFromAssembly
} from "./parse-fasten";

/** As the loaded generated sets name their studios' features. */
const GENERATED = ["fastenerScrew", "fastenerWasher", "fastenerNut"].map(
    (type) => ({ type, mateConnector: "mateConnector" })
);

describe("parseFastenInfoFromPartStudio", () => {
    it("takes a generated feature's mate connector, under the feature's id, wherever it is", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "newSketch",
                    featureId: "sketch-id",
                    name: "Sketch 1",
                    suppressed: false
                },
                {
                    featureType: "fastenerNut",
                    featureId: "suppressed-id",
                    name: "Nut",
                    suppressed: true
                },
                {
                    featureType: "fastenerNut",
                    featureId: "nut-id",
                    name: "Nut",
                    suppressed: false
                }
            ]
        };
        // Unknown until a set naming it is loaded
        expect(() => parseFastenInfoFromPartStudio(rawFeatureList)).toThrow();
        expect(
            parseFastenInfoFromPartStudio(rawFeatureList, GENERATED)
        ).toEqual({
            mateConnectorId: "nut-id.mateConnector",
            mateLocation: MateLocation.Feature,
            path: []
        });
    });

    it("takes each loaded set's features", () => {
        for (const { type: featureType } of GENERATED) {
            expect(
                parseFastenInfoFromPartStudio(
                    {
                        features: [
                            {
                                featureType,
                                featureId: "id",
                                name: featureType,
                                suppressed: false
                            }
                        ]
                    },
                    GENERATED
                ).mateConnectorId
            ).toBe("id.mateConnector");
        }
    });

    it("refuses a generated feature that names no mate connector", () => {
        expect(() =>
            parseFastenInfoFromPartStudio(
                {
                    features: [
                        {
                            featureType: "robotFrame",
                            featureId: "frame-id",
                            name: "Frame",
                            suppressed: false
                        }
                    ]
                },
                [{ type: "robotFrame" }]
            )
        ).toThrow();
    });

    it("refuses a custom feature it doesn't know makes a mate connector", () => {
        expect(() =>
            parseFastenInfoFromPartStudio({
                features: [
                    {
                        featureType: "robotFrame",
                        featureId: "frame-id",
                        name: "Frame",
                        suppressed: false
                    }
                ]
            })
        ).toThrow();
    });

    it("returns Feature location with empty path when mate connector is found", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "other",
                    featureId: "other-id",
                    name: "Other",
                    suppressed: false
                },
                {
                    featureType: "mateConnector",
                    featureId: "mate-id-1",
                    name: "Mate connector 1",
                    suppressed: false
                }
            ]
        };
        const result = parseFastenInfoFromPartStudio(rawFeatureList);
        expect(result.mateConnectorId).toBe("mate-id-1");
        expect(result.mateLocation).toBe(MateLocation.Feature);
        expect(result.path).toEqual([]);
    });

    it("uses first mate connector when multiple are present", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "mateConnector",
                    featureId: "first",
                    name: "Mate connector 1",
                    suppressed: false
                },
                {
                    featureType: "mateConnector",
                    featureId: "second",
                    name: "Mate connector 2",
                    suppressed: false
                }
            ]
        };
        const result = parseFastenInfoFromPartStudio(rawFeatureList);
        expect(result.mateConnectorId).toBe("first");
    });

    it("skips a suppressed mate connector in favor of the next valid one", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "mateConnector",
                    featureId: "suppressed-mate",
                    name: "Mate connector 1",
                    suppressed: true
                },
                {
                    featureType: "mateConnector",
                    featureId: "active-mate",
                    name: "Mate connector 2",
                    suppressed: false
                }
            ]
        };
        const result = parseFastenInfoFromPartStudio(rawFeatureList);
        expect(result.mateConnectorId).toBe("active-mate");
    });

    it("throws when the only mate connector is suppressed", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "mateConnector",
                    featureId: "suppressed-mate",
                    name: "Mate connector 1",
                    suppressed: true
                }
            ]
        };
        expect(() => parseFastenInfoFromPartStudio(rawFeatureList)).toThrow();
    });

    it("throws when no mate connector is found", () => {
        const rawFeatureList = {
            features: [
                {
                    featureType: "extrude",
                    featureId: "ext-1",
                    name: "Extrude 1",
                    suppressed: false
                }
            ]
        };
        expect(() => parseFastenInfoFromPartStudio(rawFeatureList)).toThrow();
    });
});

describe("parseFastenInfoFromAssembly", () => {
    it("returns Feature location from root assembly mate connector", () => {
        const rawAssemblyInfo = {
            rootAssembly: {
                features: [
                    {
                        featureType: "mateConnector",
                        id: "root-mate",
                        featureData: { occurrence: [] }
                    }
                ],
                instances: []
            },
            parts: [],
            subAssemblies: []
        };
        const result = parseFastenInfoFromAssembly(rawAssemblyInfo);
        expect(result.mateConnectorId).toBe("root-mate");
        expect(result.mateLocation).toBe(MateLocation.Feature);
        expect(result.path).toEqual([]);
    });

    it("returns Subassembly location from sub-assembly mate connector", () => {
        const rawAssemblyInfo = {
            rootAssembly: {
                features: [],
                instances: [{ id: "instance-id", type: "Assembly" }]
            },
            parts: [],
            subAssemblies: [
                {
                    features: [
                        {
                            featureType: "mateConnector",
                            id: "sub-mate",
                            featureData: { occurrence: [] }
                        }
                    ]
                }
            ]
        };
        const result = parseFastenInfoFromAssembly(rawAssemblyInfo);
        expect(result.mateConnectorId).toBe("sub-mate");
        expect(result.mateLocation).toBe(MateLocation.Subassembly);
        expect(result.path).toEqual(["instance-id"]);
    });

    it("returns Part location from part mate connector", () => {
        const rawAssemblyInfo = {
            rootAssembly: {
                features: [],
                instances: [{ id: "part-instance-id", type: "Part" }]
            },
            parts: [{ mateConnectors: [{ featureId: "part-mate" }] }],
            subAssemblies: []
        };
        const result = parseFastenInfoFromAssembly(rawAssemblyInfo);
        expect(result.mateConnectorId).toBe("part-mate");
        expect(result.mateLocation).toBe(MateLocation.Part);
        expect(result.path).toEqual(["part-instance-id"]);
    });

    it("throws when no mate connector found anywhere", () => {
        const rawAssemblyInfo = {
            rootAssembly: {
                features: [],
                instances: [{ id: "part-instance-id", type: "Part" }]
            },
            parts: [{ mateConnectors: [] }],
            subAssemblies: []
        };
        expect(() => parseFastenInfoFromAssembly(rawAssemblyInfo)).toThrow();
    });
});
