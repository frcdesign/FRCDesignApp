import { OnshapeApi } from "../client";
import { assertVersion } from "../assertions";
import {
    DocumentPath,
    InstancePath,
    toDocumentApiPath,
    toInstanceApiObject
} from "../path";
import { apiPath } from "../api-path";
import { OnshapeVersionInfo } from "../types";

/**
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

/** Fetches information about a version of a document. */
export function getVersion(
    client: OnshapeApi,
    versionPath: InstancePath
): Promise<OnshapeVersionInfo> {
    assertVersion(versionPath);
    return client.get(
        apiPath("documents", versionPath, toDocumentApiPath, {
            endRoute: "versions",
            endId: versionPath.instanceId
        })
    );
}

export function getLatestVersion(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeVersionInfo> {
    return getVersions(client, documentPath).then(
        (versions) => versions[versions.length - 1]
    );
}

/** Fetches the id of the most recently created version of a document. */
export function getLatestVersionId(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<string> {
    return getLatestVersion(client, documentPath).then((v) => v.id);
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
