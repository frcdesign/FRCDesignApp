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
 * `redirectUrl` is ours, built by `/init`, and wins. `redirectOnshapeUri` is
 * Onshape's and is only taken as an absolute Onshape url, since the callback
 * redirects to it unread. Anything else falls back to the entry: Onshape
 * doesn't document what it sends, and opening the app beats failing sign-in.
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

    // Absent standalone, so the user can pick their account on Onshape.
    const companyId = query.sessionCompanyId;
    const authorizationUrl = await doSignIn(c, redirectUrl, companyId);
    return c.redirect(authorizationUrl);
});

/** Standalone only: inside Onshape, the session is Onshape's to end. */
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
