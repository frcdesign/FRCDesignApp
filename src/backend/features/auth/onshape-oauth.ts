/** The Onshape OAuth handshake: where we send the user, and what comes back. */
import { HttpStatus } from "http-status-ts";
import { generateState, OAuth2Client, OAuth2Tokens } from "arctic";
import { internalError } from "../../lib/api-error";
import { env } from "cloudflare:workers";
import { type AppContext } from "../../lib/context";
import {
    type AuthTokens,
    beginSession,
    PERSONAL_COMPANY_ID,
    startLoginSession,
    takeLoginSession
} from "./session";

const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
export const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";

/**
 * Per host, so a sign-in that started on one comes back to it: two hosts share
 * an OAuth app through a cutover, and the callback's host is where `beginSession`
 * sets the cookie.
 *
 * Onshape matches this against the redirect urls registered on the OAuth app,
 * so every origin the app answers on needs one registered there, spelled the
 * same way.
 */
function getRedirectUri(c: AppContext): string {
    return new URL(c.req.url).origin + "/auth/callback";
}

/**
 * Defaulted, since only the authorization request and the code exchange carry a
 * redirect uri: arctic sends none on a refresh whatever the client holds.
 */
export function getOauthClient(
    redirectUri: string | null = null
): OAuth2Client {
    return new OAuth2Client(
        env.OAUTH_CLIENT_ID,
        env.OAUTH_CLIENT_SECRET,
        redirectUri
    );
}

export function makeAuthTokens(tokens: OAuth2Tokens): AuthTokens {
    return {
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken(),
        expiresAt: tokens.accessTokenExpiresAt().getTime()
    };
}

/**
 * Stores the redirectUrl and state.
 *
 * Returns the URL the user should be redirected to.
 */
export async function doSignIn(
    c: AppContext,
    redirectUrl: string,
    companyId?: string
): Promise<string> {
    const oauthClient = getOauthClient(getRedirectUri(c));

    const state = generateState();

    // Store the state and redirectUrl so the callback can complete sign-in.
    await startLoginSession(c, { state, redirectUrl });

    const authorizationUrl = oauthClient.createAuthorizationURL(
        AUTH_ENDPOINT,
        state,
        []
    );
    // company_id scopes the sign-in to an enterprise, and Onshape only accepts
    // a real one: sign-in worked in an enterprise and failed for plain
    // cad.onshape.com users, whose id is PERSONAL_COMPANY_ID. So that id is
    // left off, as a standalone sign-in's missing company already is.
    if (companyId && companyId !== PERSONAL_COMPANY_ID) {
        authorizationUrl.searchParams.set("company_id", companyId);
    }
    return authorizationUrl.toString();
}

export async function doCallback(c: AppContext): Promise<Response> {
    const search = c.req.query() as Record<string, string | undefined>;

    // The user clicked "Deny access" on the sign in page
    if (search.error === "access_denied") {
        return c.redirect("/grant-denied");
    }

    const session = await takeLoginSession(c);

    // There was a problem with the cookie used to store redirect information
    if (!session) {
        if (isSafari(c.req.raw)) {
            return c.redirect("/safari-error");
        }
        return c.redirect("/cookie-error");
    }

    if (!search.code || session.state !== search.state) {
        throw internalError(
            "Invalid response from Onshape",
            HttpStatus.UNAUTHORIZED
        );
    }

    // OAuth has the exchange repeat the uri the sign-in sent. This request
    // arrived at that uri, so resolving it again here gives the same string.
    const oauthClient = getOauthClient(getRedirectUri(c));

    await oauthClient
        .validateAuthorizationCode(TOKEN_ENDPOINT, search.code, null)
        .then((tokens) => makeAuthTokens(tokens))
        .then((tokens) => beginSession(c, tokens));

    return c.redirect(session.redirectUrl);
}

function isSafari(request: Request): boolean {
    const userAgent = request.headers.get("User-Agent") ?? "";
    return (
        userAgent.includes("Safari/") &&
        userAgent.includes("AppleWebKit/") &&
        !userAgent.includes("Chrome/") &&
        !userAgent.includes("CriOS/") &&
        !userAgent.includes("FxiOS/") &&
        !userAgent.includes("Edg/") &&
        !userAgent.includes("OPR/")
    );
}
