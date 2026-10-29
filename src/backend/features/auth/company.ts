import { type AppContext } from "../../lib/context";

/** What `/init` carries outside an enterprise. OAuth won't accept it as a company. */
export const PERSONAL_COMPANY_ID = "cad";

/** The company the document Onshape launched in belongs to. */
export function getSessionCompanyId(c: AppContext): string {
    return c.req.query("sessionCompanyId") ?? PERSONAL_COMPANY_ID;
}
