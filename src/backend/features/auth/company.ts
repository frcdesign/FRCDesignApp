import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/**
 * The company that owns the launch's document, which Onshape adds to every
 * launch as `companyId` (`cad` for a personal document).
 */
export function getDocumentCompanyId(c: AppContext): string {
    return c.req.query("companyId") ?? PERSONAL_COMPANY_ID;
}

/**
 * The company the caller's Onshape session is in, from the extension's
 * `{$sessionCompanyId}`: an enterprise's, and `cad` everywhere else, a
 * classroom included.
 */
export function getSessionCompanyId(c: AppContext): string {
    return c.req.query("sessionCompanyId") ?? PERSONAL_COMPANY_ID;
}

/** What sign-in names as `company_id`: OAuth takes an enterprise's id alone. */
export function getSignInCompanyId(c: AppContext): string | undefined {
    const companyId = getSessionCompanyId(c);
    return companyId === PERSONAL_COMPANY_ID ? undefined : companyId;
}
