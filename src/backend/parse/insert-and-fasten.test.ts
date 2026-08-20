import { describe, expect, it } from "vitest";
import { ElementType } from "../../shared/element-type";
import { FastenInfo, MateLocation } from "../../shared/fasten";
import {
    getFastenQuery,
    parseFastenInfoFromPartStudio,
    parseFastenInfoFromAssembly
} from "./insert-and-fasten";

describe("parseFastenInfoFromPartStudio", () => {
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

describe("getFastenQuery", () => {
    const fasten: FastenInfo = {
        mateConnectorId: "mc",
        mateLocation: MateLocation.Feature,
        path: ["fp"]
    };

    it("builds a part-studio mate connector query for a part studio target", () => {
        expect(getFastenQuery(ElementType.PART_STUDIO, ["np"], fasten)).toEqual(
            {
                btType: "BTMPartStudioMateConnectorQuery-1324",
                featureId: "mc",
                path: ["np"]
            }
        );
    });

    it("uses a part-studio query for a Part mate in an assembly (combined path)", () => {
        const partFasten: FastenInfo = {
            mateConnectorId: "mc",
            mateLocation: MateLocation.Part,
            path: ["fp"]
        };
        expect(
            getFastenQuery(ElementType.ASSEMBLY, ["np"], partFasten)
        ).toEqual({
            btType: "BTMPartStudioMateConnectorQuery-1324",
            featureId: "mc",
            path: ["np", "fp"]
        });
    });

    it("uses a feature-occurrence query for a Feature mate in an assembly", () => {
        expect(getFastenQuery(ElementType.ASSEMBLY, ["np"], fasten)).toEqual({
            btType: "BTMFeatureQueryWithOccurrence-157",
            path: ["np", "fp"],
            queryData: "",
            featureId: "mc"
        });
    });
});
