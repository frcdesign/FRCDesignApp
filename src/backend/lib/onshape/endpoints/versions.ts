import { OnshapeApi } from "../client";
import { DocumentPath, toDocumentApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeVersionInfo } from "../types";

/**
 * Fetches a list of versions of a document.
 *
 * Versions are returned in chronological order, with the oldest version ("Start") first.
 */
function getVersions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapeVersionInfo[]> {
    return client.get(
        apiPath("documents", documentPath, toDocumentApiPath, {
            endRoute: "versions"
        })
    );
}

function getLatestVersion(
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
