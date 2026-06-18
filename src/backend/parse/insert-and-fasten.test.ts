import { describe, expect, it } from "vitest";
import { MateLocation } from "../../shared/types";
import {
    parseFastenInfoFromPartStudio,
    parseFastenInfoFromAssembly
} from "./insert-and-fasten";

describe("parseFastenInfoFromPartStudio", () => {
    it("returns Feature location with empty path when mate connector is found", () => {
        const rawFeatureList = {
            features: [
                { featureType: "other", featureId: "other-id" },
                { featureType: "mateConnector", featureId: "mate-id-1" }
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
                { featureType: "mateConnector", featureId: "first" },
                { featureType: "mateConnector", featureId: "second" }
            ]
        };
        const result = parseFastenInfoFromPartStudio(rawFeatureList);
        expect(result.mateConnectorId).toBe("first");
    });

    it("throws when no mate connector is found", () => {
        const rawFeatureList = {
            features: [{ featureType: "extrude", featureId: "ext-1" }]
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
