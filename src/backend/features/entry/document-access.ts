/** Whether the caller's Onshape grant can edit the document Onshape launched in, and why not. */
import { HttpStatus } from "http-status-ts";
import {
    type OAuthApi,
    type OnshapeApi,
    OnshapeApiError
} from "../../lib/onshape/client";
import {
    getDocumentAcl,
    getPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import { OnshapeOwnerType } from "../../lib/onshape/endpoints/teams";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import { type AppContext } from "../../lib/context";
import { getDocumentCompanyId, getSessionCompanyId } from "../auth/company";
import { PERSONAL_COMPANY_ID } from "../auth/personal-company";
import { AccessProblem } from "./access-problem";

enum DocumentOwner {
    PERSONAL = "personal",
    ENTERPRISE = "enterprise",
    /** A company outside an enterprise, such as an educator plan's classroom. */
    CLASSROOM = "classroom"
}

/**
 * Undefined unless Onshape says the grant can't edit the document: whether it
 * can't see it or only view it, nothing can be inserted. Undefined too
 * whenever that can't be told: no document, no session (the app offers
 * sign-in), or Onshape failing, so a check that can't answer never keeps
 * somebody out of the app.
 */
export async function findAccessProblem(
    c: AppContext,
    documentId: string | undefined
): Promise<AccessProblem | undefined> {
    if (!documentId) return undefined;
    let api: OAuthApi;
    try {
        api = await c.var.getOnshapeApi();
    } catch {
        return undefined;
    }
    if (!(await cannotEdit(api, documentId))) return undefined;

    switch (await getDocumentOwner(c, api, documentId)) {
        case DocumentOwner.CLASSROOM:
            return AccessProblem.CLASSROOM;
        case DocumentOwner.PERSONAL:
            // Only the caller can have chosen a company's grant for a personal document.
            return (await getGrantCompanyId(api)) === PERSONAL_COMPANY_ID
                ? AccessProblem.VIEW_ONLY
                : AccessProblem.OTHER_ACCOUNT;
        case DocumentOwner.ENTERPRISE:
            return AccessProblem.VIEW_ONLY;
    }
}

async function cannotEdit(api: OnshapeApi, documentId: string) {
    try {
        const permissions = await getPermissions(api, { documentId });
        return !permissions.includes(OnshapePermission.WRITE);
    } catch (error) {
        // Onshape answers 404 for a document the grant can't see at all.
        return (
            error instanceof OnshapeApiError &&
            error.status === HttpStatus.NOT_FOUND
        );
    }
}

/**
 * From the ACL's owner, which a grant that can't see the document may not be
 * able to read; from the launch then, where only an enterprise's session
 * company is the document's own company.
 */
async function getDocumentOwner(
    c: AppContext,
    api: OnshapeApi,
    documentId: string
): Promise<DocumentOwner> {
    try {
        const { owner } = await getDocumentAcl(api, { documentId });
        if (owner.type === OnshapeOwnerType.USER) {
            return DocumentOwner.PERSONAL;
        }
        if (owner.type === OnshapeOwnerType.COMPANY) {
            return owner.isEnterpriseOwnedResource
                ? DocumentOwner.ENTERPRISE
                : DocumentOwner.CLASSROOM;
        }
    } catch (error) {
        console.warn("Couldn't read the launch document's ACL", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
    const companyId = getDocumentCompanyId(c);
    if (companyId === PERSONAL_COMPANY_ID) return DocumentOwner.PERSONAL;
    return companyId === getSessionCompanyId(c)
        ? DocumentOwner.ENTERPRISE
        : DocumentOwner.CLASSROOM;
}

/** Onshape reports no company outside an enterprise; unknown reads as personal. */
async function getGrantCompanyId(api: OAuthApi): Promise<string> {
    try {
        return (await getSessionInfo(api)).company?.id ?? PERSONAL_COMPANY_ID;
    } catch {
        return PERSONAL_COMPANY_ID;
    }
}
