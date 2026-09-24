import { OnshapeApi } from "../client";
import { DocumentPath, toDocumentApiPath } from "../path";
import { OnshapeVersionInfo } from "../types";

/** Oldest ("Start") first. */
function getVersions(
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
