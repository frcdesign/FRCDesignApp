import { OnshapeApi } from "../client";
import { assertInstanceType, assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";
import { OnshapeCreatedFeature, OnshapeFeatureListResponse } from "../types";

export function createPartStudio(
    client: OnshapeApi,
    instancePath: InstancePath,
    name: string
): Promise<any> {
    assertWorkspace(instancePath);
    return client.post(
        apiPath("partstudios", instancePath, toInstanceApiPath),
        {
            body: { name }
        }
    );
}

/**
 * Evaluates a FeatureScript script against a given part studio.
 *
 * Returns the printed output of the script parsed as JSON.
 */
export async function evaluateFeatureScript(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    script: string
): Promise<any> {
    const result = await client.post(
        apiPath("partstudios", partStudioPath, toElementApiPath, {
            endRoute: "featurescript"
        }),
        { body: { script } }
    );
    return JSON.parse(result.console);
}

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
