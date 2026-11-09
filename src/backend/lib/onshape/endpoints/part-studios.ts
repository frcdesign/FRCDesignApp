import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath } from "../path";
import { OnshapeCreatedFeature, OnshapeFeatureListResponse } from "../types";

export function addPartStudioFeature(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    feature: object,
    timeoutMs?: number
): Promise<OnshapeCreatedFeature> {
    assertInstanceType(partStudioPath, "w");
    return client.post(
        `/partstudios${toElementApiPath(partStudioPath)}/features`,
        { body: { feature }, timeoutMs }
    );
}

export function getFeatures(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<OnshapeFeatureListResponse> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/features`,
        {
            query: {
                includeSketches: "false",
                noSketchGeometry: "true",
                includeGeometryIds: "false"
            }
        }
    );
}
