/** Whether the caller's Onshape grant can edit the document Onshape launched in, and why not. */
import { HttpStatus } from "http-status-ts";
import { type OAuthApi, OnshapeApiError } from "../../lib/onshape/client";
import { getDocument } from "../../lib/onshape/endpoints/documents";
import { OnshapePermission } from "../../lib/onshape/endpoints/permissions";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import {
    OnshapeOwnerType,
    type OnshapeDocumentInfo
} from "../../lib/onshape/types";
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

    // Undefined for a document the grant can't see at all.
    let document: OnshapeDocumentInfo | undefined;
    try {
        document = await getDocument(api, { documentId });
    } catch (error) {
        if (!isUnseen(error)) return undefined;
    }
    if (document) {
        // Onshape doesn't promise to send it, and an absent one can't say no.
        if (!document.permissionSet) return undefined;
        if (document.permissionSet.includes(OnshapePermission.WRITE)) {
            return undefined;
        }
    }

    switch (toOwner(document) ?? ownerFromLaunch(c)) {
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

/** Onshape answers 403 or 404 for a document the grant can't see. */
function isUnseen(error: unknown): boolean {
    return (
        error instanceof OnshapeApiError &&
        (error.status === HttpStatus.FORBIDDEN ||
            error.status === HttpStatus.NOT_FOUND)
    );
}

function toOwner(
    document: OnshapeDocumentInfo | undefined
): DocumentOwner | undefined {
    switch (document?.owner?.type) {
        case OnshapeOwnerType.USER:
            return DocumentOwner.PERSONAL;
        case OnshapeOwnerType.COMPANY:
            return document.owner.isEnterpriseOwnedResource
                ? DocumentOwner.ENTERPRISE
                : DocumentOwner.CLASSROOM;
        default:
            return undefined;
    }
}

/** For a document the grant can't see: only an enterprise's session company is the document's own company. */
function ownerFromLaunch(c: AppContext): DocumentOwner {
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
