import { describe, expect, it } from "vitest";
import { replicateFeature } from "./assembly-features";

describe("replicateFeature", () => {
    it("matches individual edges", () => {
        const feature = replicateFeature("Replicate", [["seed"]], "mate", [
            { deterministicId: "JNO", path: ["plate"] }
        ]) as { featureType: string; parameters: object[] };

        expect(feature.featureType).toBe("replicate");
        expect(feature.parameters).toEqual([
            expect.objectContaining({
                parameterId: "seedInstances",
                queries: [
                    {
                        btType: "BTMIndividualOccurrenceQuery-626",
                        path: ["seed"]
                    }
                ]
            }),
            expect.objectContaining({
                parameterId: "seedMate",
                queries: [
                    expect.objectContaining({
                        btType: "BTMFeatureQueryWithOccurrence-157",
                        featureId: "mate"
                    })
                ]
            }),
            expect.objectContaining({
                parameterId: "seedEntityType",
                value: "EDGE"
            }),
            expect.objectContaining({
                parameterId: "faceTargetType",
                value: "SAME_OCCURRENCE"
            }),
            expect.objectContaining({
                parameterId: "targetInstances",
                queries: []
            }),
            expect.objectContaining({
                parameterId: "targetFeatures",
                queries: []
            }),
            expect.objectContaining({
                parameterId: "targetFaces",
                queries: []
            }),
            expect.objectContaining({
                parameterId: "edgeTargetType",
                value: "SAME_EDGE"
            }),
            expect.objectContaining({
                parameterId: "targetBoundingFaces",
                queries: []
            }),
            expect.objectContaining({
                parameterId: "targetPlanes",
                queries: []
            }),
            expect.objectContaining({
                parameterId: "targetEdges",
                queries: [
                    expect.objectContaining({
                        btType: "BTMIndividualQueryWithOccurrence-811",
                        deterministicIds: ["JNO"],
                        path: ["plate"]
                    })
                ]
            })
        ]);
    });
});
