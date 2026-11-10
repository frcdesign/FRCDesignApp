import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath } from "../path";
import {
    OnshapeCreatedFeature,
    OnshapeFeatureListResponse,
    OnshapeSketchList
} from "../types";

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

/** Every feature, sketches included, without their geometry. */
export function getAllFeatures(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<OnshapeFeatureListResponse> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/features`,
        {
            query: {
                noSketchGeometry: "true",
                includeGeometryIds: "false"
            }
        }
    );
}

/** Each sketch and its definition status, without its geometry. */
export function getSketches(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<OnshapeSketchList> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/sketches`,
        { query: { includeGeometry: "false" } }
    );
}
