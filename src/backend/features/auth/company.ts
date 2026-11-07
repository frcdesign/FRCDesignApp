import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/** Onshape's shared server. An enterprise has a domain of its own. */
const SHARED_SERVER_HOST = "cad.onshape.com";

/** Who owns the launch's document, which decides what sign-in can ask for. */
export enum DocumentOwner {
    PERSONAL = "personal",
    /** On its own domain; OAuth takes its id as `company_id`. */
    ENTERPRISE = "enterprise",
    /** A company on the shared server, such as an educator plan's classroom; OAuth refuses its id. */
    CLASSROOM = "classroom"
}

/**
 * The company that owns the launch's document, which Onshape adds to every
 * launch as `companyId` (`cad` for a personal document).
 */
export function getDocumentCompanyId(c: AppContext): string {
    return c.req.query("companyId") ?? PERSONAL_COMPANY_ID;
}

/** Told apart by the launch's `server`, since there is no token to ask Onshape with yet. */
export function getDocumentOwner(c: AppContext): DocumentOwner {
    if (getDocumentCompanyId(c) === PERSONAL_COMPANY_ID) {
        return DocumentOwner.PERSONAL;
    }
    return isEnterpriseServer(c.req.query("server"))
        ? DocumentOwner.ENTERPRISE
        : DocumentOwner.CLASSROOM;
}

function isEnterpriseServer(server: string | undefined): boolean {
    const host = server ? URL.parse(server)?.hostname : undefined;
    return (
        host !== undefined &&
        host !== SHARED_SERVER_HOST &&
        host.endsWith(".onshape.com")
    );
}

/** What sign-in names as `company_id`: an enterprise's alone. */
export function getSignInCompanyId(c: AppContext): string | undefined {
    return getDocumentOwner(c) === DocumentOwner.ENTERPRISE
        ? getDocumentCompanyId(c)
        : undefined;
}
