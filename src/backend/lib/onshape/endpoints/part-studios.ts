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
                // Without geometry ids, Onshape sends `featureStates` empty.
                includeGeometryIds: "true"
            }
        }
    );
}

/** `POST /partstudios/.../features/rollback`; -1 puts the bar at the end of the list. */
export function moveRollbackBar(
    client: OnshapeApi,
    partStudioPath: ElementPath,
    rollbackIndex: number
): Promise<void> {
    assertInstanceType(partStudioPath, "w");
    return client.postNone(
        `/partstudios${toElementApiPath(partStudioPath)}/features/rollback`,
        { body: { rollbackIndex } }
    );
}

/** Every feature, sketches included, without their geometry, with each feature's status. */
export function getAllFeatures(
    client: OnshapeApi,
    partStudioPath: ElementPath
): Promise<OnshapeFeatureListResponse> {
    return client.get(
        `/partstudios${toElementApiPath(partStudioPath)}/features`,
        {
            query: {
                noSketchGeometry: "true",
                // Without geometry ids, Onshape sends `featureStates` empty.
                includeGeometryIds: "true"
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
