import { OnshapeApi, OnshapeApiError } from "../client";
import { DocumentPath, toDocumentApiPath } from "../path";
import { HttpStatus } from "http-status-ts";
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

/** Empty when the document is not shared with the caller, which Onshape 403s. */
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
        if (
            error instanceof OnshapeApiError &&
            error.status === HttpStatus.FORBIDDEN
        )
            return [];
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
