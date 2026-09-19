import { OnshapeApi } from "../client";
import {
    DocumentPath,
    ElementPath,
    InstancePath,
    toDocumentApiPath,
    toElementApiObject,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";
import {
    OnshapeDocumentContents,
    OnshapeDocumentInfo,
    OnshapeExternalReferences,
    OnshapeWorkspaceInfo
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
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            skipDocumentD: true
        })
    );
}

export function getContents(
    client: OnshapeApi,
    instancePath: InstancePath,
    includeThumbnails = false
): Promise<OnshapeDocumentContents> {
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "contents"
        }),
        { query: { withThumbnails: includeThumbnails } }
    );
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
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "unitinfo"
        })
    );
}

/**
 * `GET /documents/d/{did}/workspaces`
 *
 * The document's workspaces, which is where a workspace's own name comes from.
 */
export function getWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeWorkspaceInfo[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces"
        })
    );
}

/**
 * `GET /documents/d/{did}/w/{wid}/externalreferences`
 *
 * Every external instance each of the workspace's tabs references, and the
 * newest version of each of those documents.
 *
 * See {@link OnshapeExternalReferences}: this endpoint is undocumented and
 * OAuth-only, so both the path and the response shape come from the
 * implementation this was ported from rather than from Onshape's own spec.
 * Confirmed absent from that spec: every other Onshape call the version
 * manager makes is listed in `openapi-ts.config.ts`, and adding this one there
 * generates nothing.
 */
export function getExternalReferences(
    client: OnshapeApi,
    instancePath: InstancePath
): Promise<OnshapeExternalReferences> {
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "externalreferences"
        })
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
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "updatereferences"
        }),
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
