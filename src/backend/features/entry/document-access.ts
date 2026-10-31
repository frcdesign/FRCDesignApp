/** Whether the caller's Onshape grant can edit the document Onshape launched in. */
import { HttpStatus } from "http-status-ts";
import { OnshapeApiError } from "../../lib/onshape/client";
import {
    getPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import { type AppContext } from "../../lib/context";
import { DocumentAccessProblem } from "./contract";

/**
 * Undefined when the grant can edit the document, and whenever that can't be
 * told: no document, no session (the app offers sign-in), or Onshape failing.
 * A check that can't answer never keeps somebody out of the app.
 */
export async function findDocumentAccessProblem(
    c: AppContext,
    documentId: string | undefined
): Promise<DocumentAccessProblem | undefined> {
    if (!documentId) return undefined;
    let permissions: OnshapePermission[];
    try {
        permissions = await getPermissions(await c.var.getOnshapeApi(), {
            documentId
        });
    } catch (error) {
        // Onshape answers 404 for a document the grant can't see at all.
        if (
            error instanceof OnshapeApiError &&
            error.status === HttpStatus.NOT_FOUND
        ) {
            return DocumentAccessProblem.WRONG_ACCOUNT;
        }
        return undefined;
    }
    if (permissions.includes(OnshapePermission.WRITE)) {
        return undefined;
    }
    // The person opened it in Onshape, so seeing nothing means the grant is for another account.
    return permissions.includes(OnshapePermission.READ)
        ? DocumentAccessProblem.READ_ONLY
        : DocumentAccessProblem.WRONG_ACCOUNT;
}
