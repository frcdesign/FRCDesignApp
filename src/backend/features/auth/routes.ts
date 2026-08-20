import { HttpStatus } from "http-status-ts";
import { HTTPException } from "hono/http-exception";
import { getApp } from "../../lib/context";
import { cacheMiddleware } from "../../lib/cache";
import { type AccessData } from "./access-level";
import { isSignedIn } from "./caller";
import { doCallback, doSignIn } from "./onshape-oauth";

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
        throw new HTTPException(HttpStatus.BAD_REQUEST, {
            message: "Failed to find valid redirectUrl"
        });
    }

    // Standalone sign-in omits sessionCompanyId; leave companyId undefined so the
    // user can pick their account on Onshape.
    const companyId = query.sessionCompanyId;
    const authorizationUrl = await doSignIn(c, redirectUrl, companyId);
    return c.redirect(authorizationUrl);
});

authRoutes.get("/callback", async (c) => {
    return doCallback(c);
});
