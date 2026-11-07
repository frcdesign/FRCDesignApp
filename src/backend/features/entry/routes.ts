/** Where Onshape lands: gates on auth, then hands the launch to the app. */
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { requireSignInMiddleware } from "../auth/guards";
import { trackAppOpen } from "../analytics/tracking";
import { ACCESS_PROBLEM_PARAM } from "./access-problem";
import { findAccessProblem } from "./document-access";

/** Marks the `/init` a sign-in returns to; see {@link needsSignIn}. */
const SIGN_IN_ATTEMPTED = "signInAttempted";

/**
 * No session, or one for another company than the caller's Onshape session. Asked once,
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
    // Sign-in names it as the company when it is an enterprise's.
    const sessionCompanyId = c.req.query("sessionCompanyId");
    if (sessionCompanyId) {
        query.set("sessionCompanyId", sessionCompanyId);
    }
    return `/auth/sign-in?${query.toString()}`;
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
    const problem = await findAccessProblem(c, c.req.query("documentId"));
    if (problem) {
        search.set(ACCESS_PROBLEM_PARAM, problem);
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
