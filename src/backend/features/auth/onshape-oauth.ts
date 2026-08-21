/** The Onshape OAuth handshake: where we send the user, and what comes back. */
import { HttpStatus } from "http-status-ts";
import { generateState, OAuth2Client, OAuth2Tokens } from "arctic";
import { internalError } from "../../lib/api-error";
import { env } from "cloudflare:workers";
import { type AppContext } from "../../lib/context";
import {
    type AuthTokens,
    saveTokens,
    startLoginSession,
    takeLoginSession
} from "./session";

const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
export const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";

export function getOauthClient(): OAuth2Client {
    return new OAuth2Client(env.OAUTH_CLIENT_ID, env.OAUTH_CLIENT_SECRET, null);
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
    const oauthClient = getOauthClient();

    const state = generateState();

    // Store the state and redirectUrl so the callback can complete sign-in.
    await startLoginSession(c, { state, redirectUrl });

    const authorizationUrl = oauthClient.createAuthorizationURL(
        AUTH_ENDPOINT,
        state,
        []
    );
    // Onshape-launched sign-in scopes to a company; standalone sign-in omits it
    // so the user picks their account.
    if (companyId) {
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

    const oauthClient = getOauthClient();

    await oauthClient
        .validateAuthorizationCode(TOKEN_ENDPOINT, search.code, null)
        .then((tokens) => makeAuthTokens(tokens))
        .then((tokens) => saveTokens(c.env.KV, session.sessionId, tokens));

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
