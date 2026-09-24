import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
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

/** The app's own entry, which re-runs the gate and opens wherever it lands. */
const ENTRY_PATH = "/init";

/** Onshape's own hosts. An enterprise is a subdomain, so the zone is allowed. */
function isOnshapeUrl(url: URL): boolean {
    return (
        url.protocol === "https:" &&
        (url.hostname === "onshape.com" ||
            url.hostname.endsWith(".onshape.com"))
    );
}

/**
 * Where a finished sign-in may land the caller.
 *
 * `redirectUrl` is ours: `/init` builds it from the launch it was called with,
 * so it is the only target that returns the caller to the element they opened
 * the panel on. It wins wherever there is one.
 *
 * `redirectOnshapeUri` is Onshape's, set when Onshape sends a caller here
 * itself, and the callback hands whatever was stored to `c.redirect` unread. So
 * it is only taken as an absolute url on Onshape. Onshape does not document
 * whether it can be a bare path, and one would be the more damaging case: it
 * resolves against this origin instead, landing the caller on a url the app has
 * no route for, with none of the launch parameters the panel needs.
 *
 * Anything else falls back to the entry rather than refusing the sign-in. What
 * Onshape actually sends here is not something we can see from the outside, so
 * a value this does not recognize is as likely to be our own reading being too
 * narrow as it is to be hostile, and opening the app without the caller's
 * element beats leaving them unable to sign in at all.
 */
function getSignInRedirect(query: Record<string, string>): string | undefined {
    const { redirectUrl, redirectOnshapeUri } = query;
    if (redirectUrl?.startsWith("/") && !redirectUrl.startsWith("//")) {
        return redirectUrl;
    }
    if (!redirectOnshapeUri) {
        return undefined;
    }
    try {
        if (isOnshapeUrl(new URL(redirectOnshapeUri))) {
            return redirectOnshapeUri;
        }
    } catch {
        // Not a url at all, which the fallback covers along with a bad one.
    }
    return ENTRY_PATH;
}

authRoutes.get("/sign-in", async (c) => {
    const query = c.req.query();

    const redirectUrl = getSignInRedirect(query);
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
