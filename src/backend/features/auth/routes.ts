import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { getApp } from "../../lib/context";
import { cacheMiddleware } from "../../lib/cache";
import { type AccessData } from "./access-level";
import { isSignedIn } from "./request-auth";
import { doCallback, doSignIn } from "./onshape-oauth";
import { endSession } from "./session";

/** The OAuth redirects, mounted at /auth. */
export const authRoutes = getApp();

/** What the app needs to know about the caller, mounted at /api. */
export const accessRoutes = getApp();

/** GET /api/access-data */
accessRoutes.get("/access-data", cacheMiddleware(), async (c) => {
    return c.json({
        maxAccessLevel: await c.var.getAccessLevel(),
        signedIn: await isSignedIn(c)
    } satisfies AccessData);
});

authRoutes.get("/sign-in", async (c) => {
    const query = c.req.query();

    // If Onshape hits this endpoint from, e.g., the user sign in page, they will populate redirectOnshapeUri with that page
    let redirectUrl = query.redirectOnshapeUri;
    if (!redirectUrl) {
        // Otherwise we should have one passed in
        redirectUrl = query.redirectUrl;
    }

    if (!redirectUrl) {
        throw internalError(
            "Failed to find valid redirectUrl",
            HttpStatus.BAD_REQUEST
        );
    }

    // Standalone sign-in omits sessionCompanyId; leave companyId undefined so the
    // user can pick their account on Onshape.
    const companyId = query.sessionCompanyId;
    const authorizationUrl = await doSignIn(c, redirectUrl, companyId);
    return c.redirect(authorizationUrl);
});

/**
 * Standalone only: inside Onshape the panel's session is Onshape's to end.
 * Where the caller lands is theirs to say, as long as it is this app.
 */
authRoutes.get("/sign-out", async (c) => {
    await endSession(c);
    return c.redirect(getLocalRedirect(c.req.query("redirectUrl")));
});

/** A path within the app, so the parameter cannot forward a caller offsite. */
function getLocalRedirect(redirectUrl: string | undefined): string {
    if (!redirectUrl?.startsWith("/") || redirectUrl.startsWith("//")) {
        return "/";
    }
    return redirectUrl;
}

authRoutes.get("/callback", async (c) => {
    return doCallback(c);
});
