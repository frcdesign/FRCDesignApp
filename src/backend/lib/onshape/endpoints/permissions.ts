import { HttpStatus } from "http-status-ts";
import { OnshapeApi, OnshapeApiError } from "../client";
import { DocumentPath } from "../path";
import { apiPath } from "../api-path";

/**
 * What Onshape says the caller may do with a document. Only the four the
 * version manager asks about are spelled out; Onshape sends others (COMMENT,
 * RESHARE, EXPORT, COPY, OWNER) which nothing here reads.
 */
export enum OnshapePermission {
    READ = "READ",
    WRITE = "WRITE",
    DELETE = "DELETE",
    /** Required to reference the document from another one. */
    LINK = "LINK"
}

/**
 * The caller's permissions on a document.
 *
 * A document shared with nobody answers 403 rather than an empty list, so that
 * is read as no permissions: the caller is being told they cannot see it, which
 * is the answer.
 */
export async function getPermissions(
    client: OnshapeApi,
    documentPath: DocumentPath
): Promise<OnshapePermission[]> {
    try {
        return await client.get(
            apiPath("documents", documentPath, undefined, {
                skipDocumentD: true,
                endRoute: "permissionset"
            })
        );
    } catch (error) {
        if (
            error instanceof OnshapeApiError &&
            error.status === HttpStatus.FORBIDDEN
        ) {
            return [];
        }
        throw error;
    }
}

/** Whether the caller holds every one of `needed` on the document. */
export async function hasPermissions(
    client: OnshapeApi,
    documentPath: DocumentPath,
    ...needed: OnshapePermission[]
): Promise<boolean> {
    const permissions = await getPermissions(client, documentPath);
    return needed.every((permission) => permissions.includes(permission));
}
