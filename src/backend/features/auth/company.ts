import { type AppContext } from "../../lib/context";
import { PERSONAL_COMPANY_ID } from "./personal-company";

/** The company the caller's Onshape session is in, which need not own the document. */
export function getSessionCompanyId(c: AppContext): string {
    return c.req.query("sessionCompanyId") ?? PERSONAL_COMPANY_ID;
}
