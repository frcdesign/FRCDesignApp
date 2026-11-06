/** Whether the caller's Onshape grant can edit the document Onshape launched in. */
import { HttpStatus } from "http-status-ts";
import { OnshapeApiError } from "../../lib/onshape/client";
import {
    getPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import { type AppContext } from "../../lib/context";

/**
 * True only when Onshape says the grant can't edit the document: whether it
 * can't see it (a grant for another account) or only view it (a public or
 * view-only document), nothing can be inserted. False whenever that can't be
 * told: no document, no session (the app offers sign-in), or Onshape failing,
 * so a check that can't answer never keeps somebody out of the app.
 */
export async function cannotEditDocument(
    c: AppContext,
    documentId: string | undefined
): Promise<boolean> {
    if (!documentId) return false;
    try {
        const permissions = await getPermissions(await c.var.getOnshapeApi(), {
            documentId
        });
        return !permissions.includes(OnshapePermission.WRITE);
    } catch (error) {
        // Onshape answers 404 for a document the grant can't see at all.
        return (
            error instanceof OnshapeApiError &&
            error.status === HttpStatus.NOT_FOUND
        );
    }
}
