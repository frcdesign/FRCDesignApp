import { OnshapeApi } from "../client";
import { DocumentPath, InstancePath, toDocumentApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeVersionInfo } from "../types";

/**
 * `GET /documents/d/{did}/versions`
 *
 * Fetches a list of versions of a document.
 *
 * Versions are returned in chronological order, with the oldest version ("Start") first.
 */
export function getVersions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeVersionInfo[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "versions"
        })
    );
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
        apiPath("documents", instancePath, toDocumentApiPath, {
            endRoute: "versions"
        }),
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
