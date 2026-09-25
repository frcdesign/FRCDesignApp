/** Where Onshape lands: gates on auth, then hands the launch to the app. */
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { isSignedIn } from "../auth/request-auth";
import { requireSignInMiddleware } from "../auth/guards";
import { getSessionCompanyId, PERSONAL_COMPANY_ID } from "../auth/session";
import { trackAppOpen, trackInBackground } from "../analytics/tracking";

/** Marks the `/init` a sign-in returns to; see {@link needsSignIn}. */
const SIGN_IN_ATTEMPTED = "signInAttempted";

/**
 * Onshape's authorize endpoint has no `company_id` for a personal account, so
 * a caller with an enterprise session opening a personal document can't get a
 * session for it; asking anyway loops. So only sign in when there's no session
 * or a company to name, and `SIGN_IN_ATTEMPTED` stops a second bounce.
 */
async function needsSignIn(c: AppContext): Promise<boolean> {
    if (await c.var.isAuthenticated()) return false;
    if (c.req.query(SIGN_IN_ATTEMPTED) !== undefined) return false;
    return (
        !(await isSignedIn(c)) || getSessionCompanyId(c) !== PERSONAL_COMPANY_ID
    );
}

/** Where the gate sends a caller Onshape will not take, and back to here. */
function getSignInUrl(c: AppContext): string {
    const url = new URL(c.req.url);
    url.searchParams.set(SIGN_IN_ATTEMPTED, "1");
    const query = new URLSearchParams({
        // Cloudflare strips the port in local dev, so come back relatively.
        redirectUrl: url.pathname + url.search,
        sessionCompanyId: getSessionCompanyId(c)
    });
    return `/auth/sign-in?${query.toString()}`;
}

export const entryRoutes = getApp();

/** GET /init: the app resumes the caller's last tab itself, from the browser's storage. */
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
    return c.redirect(`/?${search.toString()}`);
});

export const appOpenRoutes = getApp();

/** POST /api/app-open/library/:libraryId: sent by the app on a launch from Onshape. */
appOpenRoutes.post(
    "/app-open" + libraryRoute(),
    requireSignInMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const userId = await c.var.getUserId();
        await trackInBackground(c, () =>
            trackAppOpen(c, { libraryId, userId })
        );
        return c.json({});
    }
);
