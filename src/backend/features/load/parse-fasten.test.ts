import { describe, expect, it } from "vitest";

import { MateLocation } from "../library/insertables/fasten";
import { BuildIssueType } from "../build-checker/issues";
import {
    featureList,
    mateConnectorFeature
} from "../../../__test_utils__/feature-fixtures";
import {
    decideFasten,
    findAssemblyMateConnector,
    findPartStudioMateConnector,
    type MateConnector
} from "./parse-fasten";

/** Any feature that isn't a mate connector. */
const extrude = (featureId: string) =>
    mateConnectorFeature(featureId, { featureType: "extrude" });

describe("findPartStudioMateConnector", () => {
    it("finds the first mate connector, at the part studio's root", () => {
        const found = findPartStudioMateConnector(
            featureList([
                extrude("extrude"),
                mateConnectorFeature("first"),
                mateConnectorFeature("second")
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
            featureList([
                mateConnectorFeature("off", { suppressed: true }),
                mateConnectorFeature("on")
            ])
        );
        expect(found?.fastenInfo.mateConnectorId).toBe("on");
        expect(found?.isUnstable).toBe(false);
    });

    it("finds nothing when there is no mate connector", () => {
        expect(
            findPartStudioMateConnector(featureList([extrude("extrude")]))
        ).toBeUndefined();
        expect(
            findPartStudioMateConnector(
                featureList([mateConnectorFeature("off", { suppressed: true })])
            )
        ).toBeUndefined();
    });

    it("is unstable when a configuration can suppress it", () => {
        const found = findPartStudioMateConnector(
            featureList([
                mateConnectorFeature("first", { suppressionConfigured: true })
            ])
        );
        expect(found?.isUnstable).toBe(true);
    });

    // Another configuration would bring it back, and it would come first.
    it("is unstable when one before it is suppressed only by configuration", () => {
        const found = findPartStudioMateConnector(
            featureList([
                mateConnectorFeature("earlier", {
                    suppressed: true,
                    suppressionConfigured: true
                }),
                mateConnectorFeature("first")
            ])
        );
        expect(found?.fastenInfo.mateConnectorId).toBe("first");
        expect(found?.isUnstable).toBe(true);
    });

    it("ignores configured suppression of one after it", () => {
        const found = findPartStudioMateConnector(
            featureList([
                mateConnectorFeature("first"),
                mateConnectorFeature("later", { suppressionConfigured: true })
            ])
        );
        expect(found?.isUnstable).toBe(false);
    });

    it("is unstable when it fails to regenerate", () => {
        const found = findPartStudioMateConnector(
            featureList([mateConnectorFeature("first")], {
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

    it("fastens at the connector found", () => {
        expect(decideFasten(stable)).toEqual({
            fastenInfo: stable.fastenInfo,
            buildIssues: []
        });
    });

    it("doesn't fasten without one, and raises nothing", () => {
        expect(decideFasten(undefined)).toEqual({
            fastenInfo: null,
            buildIssues: []
        });
    });

    it("flags an unstable connector", () => {
        expect(
            decideFasten({ ...stable, isUnstable: true }).buildIssues
        ).toEqual([{ type: BuildIssueType.UNSTABLE_MATE_CONNECTOR }]);
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
