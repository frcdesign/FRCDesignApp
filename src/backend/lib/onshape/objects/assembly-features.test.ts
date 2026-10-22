import { describe, expect, it } from "vitest";
import { replicateFeature } from "./assembly-features";

describe("replicateFeature", () => {
    it("matches edges on faces as Onshape answers a Replicate doing so", () => {
        const feature = replicateFeature("Replicate", [["seed"]], "mate", {
            faces: [{ deterministicId: "JNO", path: ["plate"] }]
        }) as { featureType: string; parameters: object[] };

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
                parameterId: "edgeTargetType",
                value: "SAME_FACE"
            }),
            expect.objectContaining({
                parameterId: "targetBoundingFaces",
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
