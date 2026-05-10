import { OnshapeClient } from "../client/client";
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
} from "../path";
import { apiPath } from "../api-path";
import { OAuthClient } from "../client/oauth-client";
import { getLatestVersion } from "./versions";

/** Describes possible part types. */
export enum PartType {
    PARTS = "PARTS",
    COMPOSITE_PARTS = "COMPOSITE_PARTS"
}

/** Describes possible element (tab) types in a document. */
export enum ElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY",
    DRAWING = "DRAWING",
    FEATURE_STUDIO = "FEATURESTUDIO",
    BLOB = "BLOB"
}

/** Retrieves a given document's metadata. */
export function getDocument(
    client: OnshapeClient,
    documentPath: DocumentPath
): Promise<any> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            skipDocumentD: true
        })
    );
}

/** Retrieves the workspaces in a given document. */
export function getWorkspaces(
    client: OnshapeClient,
    documentPath: DocumentPath
): Promise<any[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces"
        })
    );
}

/** Creates a new workspace in a given document. */
export function createWorkspace(
    client: OnshapeClient,
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
    client: OnshapeClient,
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
    client: OnshapeClient,
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

/** Deletes a workspace. */
export function deleteWorkspace(
    client: OnshapeClient,
    workspacePath: InstancePath
): Promise<any> {
    assertInstanceType(workspacePath, "w");
    return client.delete(
        apiPath("documents", workspacePath, toDocumentApiPath, {
            endRoute: "workspaces",
            endId: workspacePath.instanceId
        }),
        { isJson: false }
    );
}

/** Deletes an entire document. */
export function deleteDocument(
    client: OnshapeClient,
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
    client: OnshapeClient,
    instancePath: InstancePath,
    elementType?: ElementType
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
    client: OnshapeClient,
    elementPath: ElementPath
): Promise<any | null> {
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
 * Fetches the latest microversion id of a given workspace.
 *
 * Note this is the microversion associated with the workspace as a whole.
 * Individual elements also have their own microversion ids which are unrelated to the workspace's.
 */
export function getWorkspaceMicroversionId(
    client: OnshapeClient,
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
    client: OAuthClient,
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
    client: OnshapeClient,
    elementPath: ElementPath,
    referenceUpdates: ReferenceUpdate[]
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
    client: OnshapeClient,
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
    client: OnshapeClient,
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
    client: OnshapeClient,
    instancePath: InstancePath,
    includeThumbnails = false
): Promise<any> {
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
    client: OnshapeClient,
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
    client: OnshapeClient,
    instancePath: InstancePath
): Promise<any> {
    return client.get(
        apiPath("documents", instancePath, toInstanceApiPath, {
            endRoute: "unitinfo"
        })
    );
}

/**
 * Updates all features in `elementPath` which reference `oldReferencePath` to the latest version.
 *
 * Specifically, all features in `elementPath` which reference objects in `oldReferencePath`
 * are updated to use the latest version of that reference.
 */
export async function updateToLatestVersion(
    client: OnshapeClient,
    elementPath: ElementPath,
    oldReferencePath: ElementPath
): Promise<void> {
    const latest = await getLatestVersion(client, oldReferencePath);
    await updateReferences(client, elementPath, [
        new VersionUpdate(oldReferencePath, latest.id)
    ]);
}
