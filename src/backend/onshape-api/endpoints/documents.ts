import { OnshapeApi } from "../onshape-api";
import { assertInstanceType, assertWorkspace } from "../assertions";
import {
    DocumentPath,
    ElementPath,
    InstancePath,
    toDocumentApiPath,
    toElementApiObject,
    toElementApiPath,
    toInstanceApiPath,
    toInstanceTypeKey
} from "../../../shared/onshape-path";
import { apiPath } from "../api-path";
import { OAuthApi } from "../onshape-api";
import { getLatestVersion } from "./versions";
import {
    OnshapeDocumentContents,
    OnshapeDocumentInfo,
    OnshapeElementType
} from "../onshape-types";

// `OnshapeElementType` is owned by the hand-authored types module; re-export it here so
// existing `./documents` importers keep working.
export { OnshapeElementType };

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

/** Retrieves the workspaces in a given document. */
export function getWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<any[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces"
        })
    );
}

export function createWorkspace(
    client: OnshapeApi,
    documentPath: DocumentPath,
    name: string,
    description?: string
): Promise<any> {
    return client.post(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces"
        }),
        { body: { name, description } }
    );
}

export function copyWorkspace(
    client: OnshapeApi,
    instancePath: InstancePath,
    newName: string,
    isPublic = false
): Promise<any> {
    assertWorkspace(instancePath);
    const path = `/documents/${instancePath.documentId}/workspaces/${instancePath.instanceId}/copy`;
    return client.post(path, { body: { isPublic, newName } });
}

/** Creates a new workspace in a given document referencing a specific version. */
export function createWorkspaceFromVersion(
    client: OnshapeApi,
    path: InstancePath,
    name: string,
    description?: string
): Promise<any> {
    return client.post(
        apiPath("documents", path, toDocumentApiPath, {
            endRoute: "workspaces"
        }),
        {
            body: {
                name,
                [toInstanceTypeKey(path.instanceType)]: path.instanceId,
                description
            }
        }
    );
}

export function deleteWorkspace(
    client: OnshapeApi,
    workspacePath: InstancePath
): Promise<any> {
    assertInstanceType(workspacePath, "w");
    return client.deleteNone(
        apiPath("documents", workspacePath, toDocumentApiPath, {
            endRoute: "workspaces",
            endId: workspacePath.instanceId
        })
    );
}

export function deleteDocument(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<any> {
    return client.delete(`/documents/${documentPath.documentId}`);
}

/**
 * Fetches all elements in a document.
 *
 * @param elementType The type of element (tab) to get. If omitted, all elements are returned.
 */
export async function getDocumentElements(
    client: OnshapeApi,
    instancePath: InstancePath,
    elementType?: OnshapeElementType
): Promise<any[]> {
    const query: Record<string, string | boolean> = { withThumbnails: false };
    if (elementType !== undefined) query.elementType = elementType;
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "elements"
        }),
        { query }
    );
}

/**
 * Fetches an element in a document, or null if it doesn't exist.
 */
export async function getDocumentElement(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<any> {
    const query = {
        withThumbnails: false,
        elementId: elementPath.elementId
    };
    const path = apiPath("documents", elementPath, toInstanceApiPath, {
        endRoute: "elements"
    });

    return client
        .get(path, { query })
        .then((results: any[]) => (results.length === 1 ? results[0] : null));
}

/**
 * The workspace's own microversion — unrelated to the per-element microversions
 * the load path compares.
 */
export function getWorkspaceMicroversionId(
    client: OnshapeApi,
    instancePath: InstancePath
): Promise<string> {
    assertInstanceType(instancePath, "w", "v");
    return client
        .get(
            apiPath("documents", instancePath, toInstanceApiPath, {
                endRoute: "currentmicroversion"
            })
        )
        .then((r: any) => r.microversion);
}

/**
 * An undocumented OAuth-only endpoint which returns all external references in a document.
 *
 * Generally speaking, this returns a list of the external workspaces referenced by each tab in the instance.
 */
export function getExternalReferences(
    client: OAuthApi,
    instancePath: InstancePath
): Promise<any> {
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "externalreferences"
        })
    );
}

export class ReferenceUpdate {
    constructor(
        readonly fromPath: ElementPath,
        readonly toPath: ElementPath
    ) {}

    toApiObject(): object {
        return {
            fromReference: toElementApiObject(this.fromPath),
            toReference: toElementApiObject(this.toPath)
        };
    }
}

export class VersionUpdate extends ReferenceUpdate {
    constructor(
        readonly oldReferencePath: ElementPath,
        readonly versionId: string
    ) {
        super(oldReferencePath, { ...oldReferencePath, instanceId: versionId });
    }

    override toApiObject(): object {
        return {
            fromReference: toElementApiObject(this.oldReferencePath),
            toReference: toElementApiObject(this.toPath)
        };
    }
}

/**
 * Applies all reference updates to the given tab.
 *
 * Note this endpoint does not have any return information.
 */
export function updateReferences(
    client: OnshapeApi,
    elementPath: ElementPath,
    referenceUpdates: ReferenceUpdate[]
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
): Promise<{}> {
    assertWorkspace(elementPath);
    return client.post(
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "updatereferences"
        }),
        {
            body: {
                referenceUpdates: referenceUpdates.map((u) => u.toApiObject())
            }
        }
    );
}

/** Moves one or more tabs from the source to the target. */
export function moveElements(
    client: OnshapeApi,
    sourcePath: InstancePath,
    elementIds: string[],
    targetPath: InstancePath | ElementPath,
    targetVersionName: string
): Promise<any> {
    assertWorkspace(sourcePath);
    assertWorkspace(targetPath);
    return client.post(
        apiPath("documents", sourcePath, toInstanceApiPath, {
            endRoute: "moveelement"
        }),
        {
            body: {
                elements: elementIds,
                sourceDocumentId: sourcePath.documentId,
                sourceWorkspaceId: sourcePath.instanceId,
                targetDocumentId: targetPath.documentId,
                targetWorkspaceId: targetPath.instanceId,
                versionName: targetVersionName,
                anchorElementId:
                    "elementId" in targetPath ? targetPath.elementId : undefined
            }
        }
    );
}

export function getInsertables(
    client: OnshapeApi,
    instancePath: InstancePath,
    options: {
        includeParts?: boolean;
        includePartStudios?: boolean;
        includeAssemblies?: boolean;
        includeFeatureStudios?: boolean;
    } = {}
): Promise<any> {
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "insertables"
        }),
        {
            query: {
                includeParts: options.includeParts ?? false,
                includePartStudios: options.includePartStudios ?? false,
                includeAssemblies: options.includeAssemblies ?? false,
                includeFeatureStudios: options.includeFeatureStudios ?? false
            }
        }
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

/**
 * Returns the latest microversion of a given workspace or version.
 * Note the microversion is global for the entire workspace.
 */
export function getMicroversionId(
    client: OnshapeApi,
    instancePath: InstancePath
): Promise<string> {
    return client
        .get(
            apiPath("documents", instancePath, toInstanceApiPath, {
                endRoute: "currentmicroversion"
            })
        )
        .then((r: any) => r.microversion);
}

/**
 * Returns units and precision settings for a given document.
 */
export function getUnitInfo(
    onshapeApi: OnshapeApi,
    instancePath: InstancePath
): Promise<any> {
    return onshapeApi.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "unitinfo"
        })
    );
}

/**
 * Updates every feature in `elementPath` referencing `oldReferencePath` to that
 * reference's latest version.
 */
export async function updateToLatestVersion(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    oldReferencePath: ElementPath
): Promise<void> {
    const latest = await getLatestVersion(onshapeApi, oldReferencePath);
    await updateReferences(onshapeApi, elementPath, [
        new VersionUpdate(oldReferencePath, latest.id)
    ]);
}
