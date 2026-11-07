import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/** Who owns the launch's document, which decides what sign-in can ask for. */
export enum DocumentOwner {
    PERSONAL = "personal",
    /** OAuth takes its id as `company_id`. */
    ENTERPRISE = "enterprise",
    /** A company outside an enterprise, such as an educator plan's classroom; OAuth refuses its id. */
    CLASSROOM = "classroom"
}

/**
 * The company that owns the launch's document, which Onshape adds to every
 * launch as `companyId` (`cad` for a personal document).
 */
export function getDocumentCompanyId(c: AppContext): string {
    return c.req.query("companyId") ?? PERSONAL_COMPANY_ID;
}

/**
 * Told apart by the launch's `sessionCompanyId`, since there is no token to ask
 * Onshape with yet: Onshape fills it in for an enterprise alone, and sends `cad`
 * everywhere else, a classroom included.
 */
export function getDocumentOwner(c: AppContext): DocumentOwner {
    if (getDocumentCompanyId(c) === PERSONAL_COMPANY_ID) {
        return DocumentOwner.PERSONAL;
    }
    const sessionCompanyId = c.req.query("sessionCompanyId");
    return sessionCompanyId && sessionCompanyId !== PERSONAL_COMPANY_ID
        ? DocumentOwner.ENTERPRISE
        : DocumentOwner.CLASSROOM;
}

/** What sign-in names as `company_id`: an enterprise's alone. */
export function getSignInCompanyId(c: AppContext): string | undefined {
    return getDocumentOwner(c) === DocumentOwner.ENTERPRISE
        ? getDocumentCompanyId(c)
        : undefined;
}
