import { OnshapeApi } from "../client";
import { DocumentPath, toDocumentApiPath } from "../path";
import { OnshapeWorkspaceInfo } from "../types";

export function getWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeWorkspaceInfo[]> {
    return client.get(
        `/documents${toDocumentApiPath(documentPath)}/workspaces`
    );
}
