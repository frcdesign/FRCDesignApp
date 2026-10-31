import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/** The company the document Onshape launched in belongs to. */
export function getSessionCompanyId(c: AppContext): string {
    return c.req.query("sessionCompanyId") ?? PERSONAL_COMPANY_ID;
}
