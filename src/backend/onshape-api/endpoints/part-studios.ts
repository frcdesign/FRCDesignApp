import { OnshapeApi } from "../client/onshape-api";
import { assertInstanceType, assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../../../shared/path";
import { apiPath } from "../api-path";

/** Creates a part studio in a document. */
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

/** Adds a feature to a part studio. */
export function addFeature(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    feature: object
): Promise<any> {
    assertInstanceType(partStudioPath, "w");
    return client.post(
        apiPath("partstudios", partStudioPath, toElementApiPath, {
            endRoute: "features"
        }),
        { body: { feature } }
    );
}

/** Returns the features in a part studio. */
export function getFeatures(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<any> {
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
