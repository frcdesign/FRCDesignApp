import { OnshapeApi } from "../client/onshape-api";
import { assertVersion } from "../assertions";
import {
    DocumentPath,
    InstancePath,
    toDocumentApiPath,
    toInstanceApiObject
} from "../../../shared/path";
import { apiPath } from "../api-path";

/**
 * Fetches a list of versions of a document.
 *
 * Versions are returned in chronological order, with the oldest version ("Start") first.
 */
export function getVersions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<any[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "versions"
        })
    );
}

/** Fetches information about a version of a document. */
export function getVersion(
    client: OnshapeApi,
    versionPath: InstancePath
): Promise<any> {
    assertVersion(versionPath);
    return client.get(
        apiPath("documents", versionPath, toDocumentApiPath, {
            endRoute: "versions",
            endId: versionPath.instanceId
        })
    );
}

export function getLatestVersionPath(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<InstancePath> {
    return getLatestVersion(client, documentPath).then((v) => ({
        ...documentPath,
        instanceId: v.id,
        instanceType: "v" as const
    }));
}

export function getLatestVersion(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<any> {
    return getVersions(client, documentPath).then(
        (versions) => versions[versions.length - 1]
    );
}

/** Creates a new version of a document from a given instance. */
export function createVersion(
    client: OnshapeApi,
    instancePath: InstancePath,
    versionName: string,
    description: string
): Promise<any> {
    return client.post(
        apiPath("documents", instancePath, toDocumentApiPath, {
            endRoute: "versions"
        }),
        {
            body: {
                name: versionName,
                description,
                ...toInstanceApiObject(instancePath)
            }
        }
    );
}
