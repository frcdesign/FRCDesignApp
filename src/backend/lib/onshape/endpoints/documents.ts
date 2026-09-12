import { OnshapeApi } from "../client";
import {
    DocumentPath,
    InstancePath,
    toDocumentApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";
import { OnshapeDocumentContents, OnshapeDocumentInfo } from "../types";

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
