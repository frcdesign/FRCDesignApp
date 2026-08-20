import { OnshapeApi } from "../client";
import { assertInstanceType, assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";

/**
 * Fetches code from a feature studio.
 *
 * @param rawResponse True to get the entire response object, false to get just the code string.
 */
export async function pullCode(
    client: OnshapeApi,
    featureStudioPath: ElementPath,
    rawResponse = false
): Promise<any> {
    const response = await client.get(
        apiPath("featurestudios", featureStudioPath, toElementApiPath)
    );
    return rawResponse ? response : response.contents;
}

/** Sends code to the given feature studio. */
export function pushCode(
    client: OnshapeApi,
    featureStudioPath: ElementPath,
    code: string
): Promise<any> {
    assertWorkspace(featureStudioPath);
    return client.post(
        apiPath("featurestudios", featureStudioPath, toElementApiPath),
        { body: { contents: code } }
    );
}

export function createFeatureStudio(
    client: OnshapeApi,
    instancePath: InstancePath,
    studioName: string
): Promise<any> {
    assertInstanceType(instancePath, "w");
    return client.post(
        apiPath("featurestudios", instancePath, toInstanceApiPath),
        { body: { name: studioName } }
    );
}

export function getFeatureSpecs(
    client: OnshapeApi,
    featureStudioPath: ElementPath
): Promise<any> {
    return client.get(
        apiPath("featurestudios", featureStudioPath, toElementApiPath, {
            endRoute: "featurespecs"
        })
    );
}

/** Returns the feature spec for the first custom feature in a given Feature Studio. */
export async function getFeatureSpec(
    client: OnshapeApi,
    featureStudioPath: ElementPath
): Promise<any> {
    const featureSpecs = await getFeatureSpecs(client, featureStudioPath);
    if (featureSpecs.featureSpecs.length < 1) {
        throw new Error(
            "The specified feature studio did not have any custom features"
        );
    }
    return featureSpecs.featureSpecs[0];
}
