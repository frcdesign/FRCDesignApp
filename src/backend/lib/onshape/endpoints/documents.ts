import { OnshapeApi } from "../client";
import {
    DocumentPath,
    ElementPath,
    InstancePath,
    toElementApiObject,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import {
    OnshapeDocumentContents,
    OnshapeDocumentInfo,
    OnshapeExternalReferences,
    OnshapeInsertables
} from "../types";

/** Describes possible part types. */
export enum PartType {
    PARTS = "PARTS",
    COMPOSITE_PARTS = "COMPOSITE_PARTS"
}

/** Retrieves a given document's metadata. */
export function getDocument(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeDocumentInfo> {
    return client.get(`/documents/${documentPath.documentId}`);
}

export function getContents(
    client: OnshapeApi,
    instancePath: InstancePath,
    includeThumbnails = false
): Promise<OnshapeDocumentContents> {
    return client.get(`/documents${toInstanceApiPath(instancePath)}/contents`, {
        query: { withThumbnails: includeThumbnails }
    });
}

/** The document's units, as much of the response as anything here reads. */
interface OnshapeUnitInfo {
    defaultUnits: { units: { key: string; value: string }[] };
    /** Display precision per unit, keyed by the unit's own name. */
    unitsDisplayPrecision: Record<string, number>;
}

/** Units and precision settings for a given document. */
export function getUnitInfo(
    onshapeApi: OnshapeApi,
    instancePath: InstancePath
): Promise<OnshapeUnitInfo> {
    return onshapeApi.get(
        `/documents${toInstanceApiPath(instancePath)}/unitinfo`
    );
}

/**
 * `GET /documents/d/{did}/{wv}/{wvid}/insertables`
 *
 * What can be inserted from an instance, and how far a workspace has moved
 * since its last version. Every `include` flag defaults to false, so a caller
 * after the counters alone passes no query at all and Onshape enumerates
 * nothing.
 */
export function getInsertables(
    client: OnshapeApi,
    instancePath: InstancePath,
    query: Record<string, string | boolean> = {}
): Promise<OnshapeInsertables> {
    return client.get(
        `/documents${toInstanceApiPath(instancePath)}/insertables`,
        { query }
    );
}

/**
 * `GET /documents/d/{did}/w/{wid}/externalreferences`
 *
 * Every version of another document this workspace's tabs reference, and the
 * latest version of each of those documents — which together say what is out of
 * date. Undocumented and OAuth-only, as far as the app that first used it could
 * tell; it is absent from Onshape's OpenAPI spec.
 */
export function getExternalReferences(
    client: OnshapeApi,
    instancePath: InstancePath
): Promise<OnshapeExternalReferences> {
    return client.get(
        `/documents${toInstanceApiPath(instancePath)}/externalreferences`
    );
}

/** Repoints a reference from one path to another; both name the same tab. */
export interface ReferenceUpdate {
    fromReference: ElementPath;
    toReference: ElementPath;
}

/**
 * `POST /elements/d/{did}/w/{wid}/e/{eid}/updatereferences`
 *
 * Repoints the references one tab makes: each update names the element path a
 * reference points at now and the one it should point at instead, which for a
 * version bump is the same tab in a newer version.
 *
 * Onshape answers with no body worth reading, so a caller learns only that it
 * did not throw. Requires write on the tab's document, and link on each
 * document being referenced.
 */
export function updateReferences(
    client: OnshapeApi,
    elementPath: ElementPath,
    referenceUpdates: ReferenceUpdate[]
): Promise<void> {
    return client.postNone(
        `/elements${toElementApiPath(elementPath)}/updatereferences`,
        {
            body: {
                referenceUpdates: referenceUpdates.map((update) => ({
                    fromReference: toElementApiObject(update.fromReference),
                    toReference: toElementApiObject(update.toReference)
                }))
            }
        }
    );
}
