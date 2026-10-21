import { OnshapeApi } from "../client";
import { DocumentPath, InstancePath, toDocumentApiPath } from "../path";
import { OnshapeVersionInfo } from "../types";

/** Oldest ("Start") first. */
export function getVersions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeVersionInfo[]> {
    return client.get(`/documents${toDocumentApiPath(documentPath)}/versions`);
}

/** The most recently created version of a document, with when it was cut. */
export function getLatestVersion(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeVersionInfo> {
    return getVersions(client, documentPath).then(
        (versions) => versions[versions.length - 1]
    );
}

export function getVersion(
    client: OnshapeApi,
    documentPath: DocumentPath,
    versionId: string
): Promise<OnshapeVersionInfo> {
    return client.get(
        `/documents${toDocumentApiPath(documentPath)}/versions/${encodeURIComponent(versionId)}`
    );
}

/**
 * `POST /documents/d/{did}/versions`
 *
 * Cuts a version of a workspace. Onshape takes the instance in the body as well
 * as the document in the path, which is why this asks for a whole instance.
 * Requires write on the document.
 */
export function createVersion(
    client: OnshapeApi,
    instancePath: InstancePath,
    name: string,
    description = ""
): Promise<OnshapeVersionInfo> {
    return client.post(
        `/documents${toDocumentApiPath(instancePath)}/versions`,
        {
            body: {
                name,
                description,
                documentId: instancePath.documentId,
                workspaceId: instancePath.instanceId
            }
        }
    );
}
