import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementPath, toElementApiPath } from "../path";
import {
    OnshapeCreatedFeature,
    OnshapeFeatureListResponse,
    OnshapeFeatureScriptResponse
} from "../types";

export function addPartStudioFeature(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    feature: object
): Promise<OnshapeCreatedFeature> {
    assertInstanceType(partStudioPath, "w");
    return client.post(
        `/partstudios${toElementApiPath(partStudioPath)}/features`,
        { body: { feature } }
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

/**
 * Runs a FeatureScript lambda in a Part Studio. `elementMicroversionId` pins a
 * workspace's tab to that edit of it.
 */
export function evaluateFeatureScript(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    script: string,
    options: { configuration?: string; elementMicroversionId?: string } = {}
): Promise<OnshapeFeatureScriptResponse> {
    const query: Record<string, string> = {};
    if (options.configuration) {
        query.configuration = options.configuration;
    }
    if (options.elementMicroversionId) {
        query.elementMicroversionId = options.elementMicroversionId;
    }
    return client.post(
        `/partstudios${toElementApiPath(partStudioPath)}/featurescript`,
        { query, body: { script } }
    );
}
