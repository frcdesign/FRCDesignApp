import { getApp } from "../../lib/context";
import { cacheMiddleware } from "../../lib/cache";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { type AccessData } from "./access-level";
import { isSignedIn } from "./request-auth";
import { doCallback, doSignIn } from "./onshape-oauth";
import { endSession } from "./session";

/** The OAuth redirects, mounted at /auth. */
export const authRoutes = getApp();

/** What the app needs to know about the caller, mounted at /api. */
export const accessRoutes = getApp();

/** GET /api/access-data/library/:libraryId */
accessRoutes.get(
    "/access-data" + libraryRoute(),
    cacheMiddleware(),
    async (c) => {
        return c.json({
            maxAccessLevel: await c.var.getAccessLevel(getLibraryParam(c)),
            signedIn: await isSignedIn(c)
        } satisfies AccessData);
    }
);

/** A path within the app, so the parameter cannot forward a caller offsite. */
function toLocalPath(redirectUrl: string | undefined): string {
    if (!redirectUrl?.startsWith("/") || redirectUrl.startsWith("//")) {
        return "/";
    }
    return redirectUrl;
}

/** GET /auth/sign-in?redirectUrl=&sessionCompanyId= */
authRoutes.get("/sign-in", (c) => {
    const redirectUrl = toLocalPath(c.req.query("redirectUrl"));
    // Absent standalone, so the user can pick their account on Onshape.
    const companyId = c.req.query("sessionCompanyId");
    return c.redirect(doSignIn(c, redirectUrl, companyId));
});

/** Standalone only: inside Onshape, the session is Onshape's to end. */
authRoutes.get("/sign-out", async (c) => {
    await endSession(c);
    return c.redirect(toLocalPath(c.req.query("redirectUrl")));
});

authRoutes.get("/callback", async (c) => {
    return doCallback(c);
});
