import { describe, expect, it } from "vitest";

import { MateLocation } from "../library/insertables/fasten";
import { ElementType } from "../../lib/onshape/element-type";
import { BuildIssueType } from "../build-checker/issues";
import type { OnshapeFeatureListResponse } from "../../lib/onshape/types";
import {
    decideFasten,
    findAssemblyMateConnector,
    findPartStudioMateConnector,
    type MateConnector
} from "./parse-fasten";

function feature(
    featureId: string,
    options: {
        featureType?: string;
        suppressed?: boolean;
        suppressionConfigured?: boolean;
    } = {}
) {
    return {
        featureType: options.featureType ?? "mateConnector",
        featureId,
        name: featureId,
        suppressed: options.suppressed ?? false,
        suppressionConfigured: options.suppressionConfigured
    };
}

function features(
    list: ReturnType<typeof feature>[],
    featureStates?: OnshapeFeatureListResponse["featureStates"]
): OnshapeFeatureListResponse {
    return { features: list, featureStates };
}

describe("findPartStudioMateConnector", () => {
    it("finds the first mate connector, at the part studio's root", () => {
        const found = findPartStudioMateConnector(
            features([
                feature("extrude", { featureType: "extrude" }),
                feature("first"),
                feature("second")
            ])
        );
        expect(found).toEqual({
            fastenInfo: {
                mateConnectorId: "first",
                mateLocation: MateLocation.Feature,
                path: []
            },
            isUnstable: false
        });
    });

    it("passes over one suppressed in every configuration", () => {
        const found = findPartStudioMateConnector(
            features([feature("off", { suppressed: true }), feature("on")])
        );
        expect(found?.fastenInfo.mateConnectorId).toBe("on");
        expect(found?.isUnstable).toBe(false);
    });

    it("finds nothing when there is no mate connector", () => {
        expect(
            findPartStudioMateConnector(
                features([feature("extrude", { featureType: "extrude" })])
            )
        ).toBeUndefined();
        expect(
            findPartStudioMateConnector(
                features([feature("off", { suppressed: true })])
            )
        ).toBeUndefined();
    });

    it("is unstable when a configuration can suppress it", () => {
        const found = findPartStudioMateConnector(
            features([feature("first", { suppressionConfigured: true })])
        );
        expect(found?.isUnstable).toBe(true);
    });

    // Another configuration would bring it back, and it would come first.
    it("is unstable when one before it is suppressed only by configuration", () => {
        const found = findPartStudioMateConnector(
            features([
                feature("earlier", {
                    suppressed: true,
                    suppressionConfigured: true
                }),
                feature("first")
            ])
        );
        expect(found?.fastenInfo.mateConnectorId).toBe("first");
        expect(found?.isUnstable).toBe(true);
    });

    it("ignores configured suppression of one after it", () => {
        const found = findPartStudioMateConnector(
            features([
                feature("first"),
                feature("later", { suppressionConfigured: true })
            ])
        );
        expect(found?.isUnstable).toBe(false);
    });

    it("is unstable when it fails to regenerate", () => {
        const found = findPartStudioMateConnector(
            features([feature("first")], {
                first: { featureStatus: "ERROR" }
            })
        );
        expect(found?.isUnstable).toBe(true);
    });
});

describe("decideFasten", () => {
    const stable: MateConnector = {
        fastenInfo: {
            mateConnectorId: "mc",
            mateLocation: MateLocation.Feature,
            path: []
        },
        isUnstable: false
    };

    it("fastens a part studio with a mate connector by default", () => {
        expect(
            decideFasten(ElementType.PART_STUDIO, undefined, stable)
        ).toEqual({ supportsFasten: true, fastenInfo: stable.fastenInfo });
    });

    it("leaves a part studio without one alone, raising nothing", () => {
        expect(
            decideFasten(ElementType.PART_STUDIO, undefined, undefined)
        ).toEqual({ supportsFasten: false, fastenInfo: null });
    });

    it("leaves an assembly off by default", () => {
        expect(decideFasten(ElementType.ASSEMBLY, undefined, stable)).toEqual({
            supportsFasten: false,
            fastenInfo: stable.fastenInfo
        });
    });

    it("keeps the connector it found when an admin turned fastening off", () => {
        expect(decideFasten(ElementType.PART_STUDIO, false, stable)).toEqual({
            supportsFasten: false,
            fastenInfo: stable.fastenInfo
        });
    });

    it("flags an unstable connector it fastens to", () => {
        expect(
            decideFasten(ElementType.PART_STUDIO, undefined, {
                ...stable,
                isUnstable: true
            }).issue
        ).toBe(BuildIssueType.UNSTABLE_MATE_CONNECTOR);
        expect(
            decideFasten(ElementType.PART_STUDIO, false, {
                ...stable,
                isUnstable: true
            }).issue
        ).toBeUndefined();
    });

    it("flags fastening turned on with nothing to fasten to", () => {
        expect(decideFasten(ElementType.ASSEMBLY, true, undefined)).toEqual({
            supportsFasten: false,
            fastenInfo: null,
            issue: BuildIssueType.NO_MATE_CONNECTOR
        });
    });
});

describe("findAssemblyMateConnector", () => {
    it("returns Feature location from root assembly mate connector", () => {
        const result = findAssemblyMateConnector({
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
        });
        expect(result).toEqual({
            mateConnectorId: "root-mate",
            mateLocation: MateLocation.Feature,
            path: []
        });
    });

    it("returns Subassembly location from sub-assembly mate connector", () => {
        const result = findAssemblyMateConnector({
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
        });
        expect(result).toEqual({
            mateConnectorId: "sub-mate",
            mateLocation: MateLocation.Subassembly,
            path: ["instance-id"]
        });
    });

    it("returns Part location from part mate connector", () => {
        const result = findAssemblyMateConnector({
            rootAssembly: {
                features: [],
                instances: [{ id: "part-instance-id", type: "Part" }]
            },
            parts: [{ mateConnectors: [{ featureId: "part-mate" }] }],
            subAssemblies: []
        });
        expect(result).toEqual({
            mateConnectorId: "part-mate",
            mateLocation: MateLocation.Part,
            path: ["part-instance-id"]
        });
    });

    it("finds nothing when no mate connector is anywhere", () => {
        expect(
            findAssemblyMateConnector({
                rootAssembly: {
                    features: [],
                    instances: [{ id: "part-instance-id", type: "Part" }]
                },
                parts: [{ mateConnectors: [] }],
                subAssemblies: []
            })
        ).toBeUndefined();
    });
});
