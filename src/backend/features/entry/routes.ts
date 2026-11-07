/** Where Onshape lands: gates on auth, then hands the launch to the app. */
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { requireSignInMiddleware } from "../auth/guards";
import { DocumentOwner, getDocumentOwner } from "../auth/company";
import { trackAppOpen } from "../analytics/tracking";
import { ACCESS_PROBLEM_PARAM, AccessProblem } from "./access-problem";
import { cannotEditDocument } from "./document-access";

/** Marks the `/init` a sign-in returns to; see {@link needsSignIn}. */
const SIGN_IN_ATTEMPTED = "signInAttempted";

/**
 * No session, or one for another company than the document's. Asked once,
 * marked by `SIGN_IN_ATTEMPTED`: Onshape may hand back a token for the company
 * the caller is signed in to whatever is asked, which would otherwise loop.
 */
async function needsSignIn(c: AppContext): Promise<boolean> {
    return (
        c.req.query(SIGN_IN_ATTEMPTED) === undefined &&
        !(await c.var.isAuthenticated())
    );
}

/** Where the gate sends a caller Onshape will not take, and back to here. */
function getSignInUrl(c: AppContext): string {
    const url = new URL(c.req.url);
    url.searchParams.set(SIGN_IN_ATTEMPTED, "1");
    // Cloudflare strips the port in local dev, so come back relatively.
    const query = new URLSearchParams({
        redirectUrl: url.pathname + url.search
    });
    // Sign-in decides from these whether it can name the company.
    for (const key of ["companyId", "server"]) {
        const value = c.req.query(key);
        if (value) query.set(key, value);
    }
    return `/auth/sign-in?${query.toString()}`;
}

/**
 * A classroom's grant is the caller's to give on Onshape's side. Otherwise a
 * grant for another account than the document's can only be one the caller
 * chose, and the right account's grant that still can't edit is view-only.
 */
async function toAccessProblem(c: AppContext): Promise<AccessProblem> {
    if (getDocumentOwner(c) === DocumentOwner.CLASSROOM) {
        return AccessProblem.CLASSROOM;
    }
    return (await c.var.isAuthenticated())
        ? AccessProblem.VIEW_ONLY
        : AccessProblem.OTHER_ACCOUNT;
}

export const entryRoutes = getApp();

/**
 * GET /init: the app resumes the caller's last tab itself, from the browser's
 * storage. A grant that can't edit the document goes to `/document-access`
 * first: a session for the right company can still be one Onshape refuses.
 */
entryRoutes.get("/init", cacheMiddleware(), async (c) => {
    // A version can't be changed, so there is nothing to insert into.
    const instanceType = c.req.query("instanceType");
    if (instanceType === "v" || instanceType === "m") {
        return c.redirect("/version-error");
    }
    if (await needsSignIn(c)) {
        return c.redirect(getSignInUrl(c));
    }
    const search = new URL(c.req.url).searchParams;
    // Ours, and spent: the app is being opened, however that turned out.
    search.delete(SIGN_IN_ATTEMPTED);
    if (await cannotEditDocument(c, c.req.query("documentId"))) {
        search.set(ACCESS_PROBLEM_PARAM, await toAccessProblem(c));
        return c.redirect(`/document-access?${search.toString()}`);
    }
    return c.redirect(`/?${search.toString()}`);
});

export const appOpenRoutes = getApp();

/** POST /api/app-open: sent by the app on a launch from Onshape. */
appOpenRoutes.post("/app-open", requireSignInMiddleware, async (c) => {
    await trackAppOpen(c);
    return c.json({});
});
