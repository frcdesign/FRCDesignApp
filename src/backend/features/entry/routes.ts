/** Where Onshape lands: gates on auth, then hands the launch to the app. */
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { requireSignInMiddleware } from "../auth/guards";
import { getSessionCompanyId } from "../auth/company";
import { trackAppOpen } from "../analytics/tracking";

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
        await trackAppOpen(c, getLibraryParam(c));
        return c.json({});
    }
);
