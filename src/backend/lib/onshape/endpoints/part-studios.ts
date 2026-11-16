import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
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

function configurationQuery(configuration: Selection): Record<string, string> {
    const encoded = encodeQueryConfiguration(configuration);
    return encoded ? { configuration: encoded } : {};
}

/** Every face of every part, as triangles; the shape is in docs/ONSHAPE.md. Metres. */
export function getTessellatedFaces(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    configuration: Selection
): Promise<unknown> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/tessellatedfaces`,
        {
            query: {
                ...configurationQuery(configuration),
                outputVertexNormals: "true",
                outputFacetNormals: "true"
            }
        }
    );
}

/** Every edge of every part, as polylines. Metres. */
export function getTessellatedEdges(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    configuration: Selection
): Promise<unknown> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/tessellatededges`,
        { query: configurationQuery(configuration) }
    );
}
