import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeCreatedFeature, OnshapeFeatureListResponse } from "../types";

export function addPartStudioFeature(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    feature: object
): Promise<OnshapeCreatedFeature> {
    assertInstanceType(partStudioPath, "w");
    return client.post(
        apiPath("partstudios", partStudioPath, toElementApiPath, {
            endRoute: "features"
        }),
        { body: { feature } }
    );
}

export function getFeatures(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<OnshapeFeatureListResponse> {
    return client.get(
        apiPath("partstudios", partStudioPath, toElementApiPath, {
            endRoute: "features"
        }),
        {
            query: {
                includeSketches: "false",
                noSketchGeometry: "true",
                includeGeometryIds: "false"
            }
        }
    );
}
