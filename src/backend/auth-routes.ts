import { HttpStatus } from "http-status-ts";
import { HTTPException } from "hono/http-exception";
import { getApp } from "./context";
import { doCallback, doSignIn } from "./auth-oauth";

export const authRoutes = getApp();

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
