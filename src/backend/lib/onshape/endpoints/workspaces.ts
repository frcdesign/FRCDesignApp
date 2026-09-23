import { OnshapeApi } from "../client";
import { DocumentPath, toDocumentApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeWorkspaceInfo } from "../types";

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

export function createWorkspace(
    client: OnshapeApi,
    documentPath: DocumentPath,
    branch: { name: string; description: string; versionId: string }
): Promise<OnshapeWorkspaceInfo> {
    return client.post(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces"
        }),
        { body: branch }
    );
}

export function deleteWorkspace(
    client: OnshapeApi,
    documentPath: DocumentPath,
    workspaceId: string
): Promise<void> {
    return client.deleteNone(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "workspaces",
            endId: workspaceId
        })
    );
}
