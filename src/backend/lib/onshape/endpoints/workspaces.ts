import { OnshapeApi } from "../client";
import { DocumentPath, InstancePath, toDocumentApiPath } from "../path";
import { OnshapeWorkspaceInfo } from "../types";

export function getWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeWorkspaceInfo[]> {
    return client.get(
        `/documents${toDocumentApiPath(documentPath)}/workspaces`
    );
}

export function createWorkspace(
    client: OnshapeApi,
    documentPath: DocumentPath,
    branch: { name: string; description: string; versionId: string }
): Promise<OnshapeWorkspaceInfo> {
    return client.post(
        `/documents${toDocumentApiPath(documentPath)}/workspaces`,
        { body: branch }
    );
}

export function deleteWorkspace(
    client: OnshapeApi,
    documentPath: DocumentPath,
    workspaceId: string
): Promise<void> {
    return client.deleteNone(
        `/documents${toDocumentApiPath(documentPath)}/workspaces/${encodeURIComponent(workspaceId)}`
    );
}

/** Replaces the workspace's contents with a version's, as a new microversion. */
export function restoreVersion(
    client: OnshapeApi,
    workspacePath: InstancePath,
    versionId: string
): Promise<void> {
    return client.postNone(
        `/documents/${workspacePath.documentId}/w/${encodeURIComponent(workspacePath.instanceId)}/restore/v/${encodeURIComponent(versionId)}`,
        { body: {} }
    );
}
