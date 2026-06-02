import { OnshapeApi, OnshapeApiError } from "../onshape-api";
import { DocumentPath, toDocumentApiPath } from "../../../shared/path";
import { apiPath } from "../api-path";

export enum Permission {
    READ = "READ",
    WRITE = "WRITE",
    COMMENT = "COMMENT",
    RESHARE = "RESHARE",
    EXPORT = "EXPORT",
    DELETE = "DELETE",
    LINK = "LINK",
    COPY = "COPY",
    OWNER = "OWNER"
}

/**
 * Returns the permissions the authenticated user has on a document.
 *
 * Returns an empty array if the document is not shared with the user (Onshape returns 403 in that case).
 */
export async function getPermissions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<Permission[]> {
    try {
        const permissions = await client.get(
            apiPath("documents", documentPath, toDocumentApiPath, {
                endRoute: "permissionset",
                skipDocumentD: true
            })
        );
        return permissions.map((p: string) => p as Permission);
    } catch (error) {
        if (error instanceof OnshapeApiError && error.status === 403) return [];
        throw error;
    }
}

export async function hasPermissions(
    client: OnshapeApi,
    documentPath: DocumentPath,
    ...neededPermissions: Permission[]
): Promise<boolean> {
    const permissions = await getPermissions(client, documentPath);
    return neededPermissions.every((p) => permissions.includes(p));
}
