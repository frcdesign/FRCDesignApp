import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/**
 * The company whose grant can edit the launch's document: its owner, which
 * Onshape adds to every launch as `companyId` (`cad` for a personal document).
 * An enterprise or an educator plan's classroom is a company like any other.
 */
export function getDocumentCompanyId(c: AppContext): string {
    return c.req.query("companyId") ?? PERSONAL_COMPANY_ID;
}
