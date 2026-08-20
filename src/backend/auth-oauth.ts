/** The Onshape OAuth flow, and the API client a stored session produces. */
import { HttpStatus } from "http-status-ts";
import { generateState, OAuth2Client, OAuth2Tokens } from "arctic";
import { HTTPException } from "hono/http-exception";
import { env } from "cloudflare:workers";
import { OAuthApi } from "./onshape-api/onshape-api";
import { getSessionInfo, getUserId } from "./onshape-api/endpoints/users";
import { type AppContext } from "./context";
import {
    type AuthTokens,
    SESSION_TTL,
    getSessionCompanyId,
    getSessionId,
    getTokens,
    saveTokens,
    startLoginSession,
    takeLoginSession
} from "./auth-session";

const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";

function getOauthClient(): OAuth2Client {
    return new OAuth2Client(env.OAUTH_CLIENT_ID, env.OAUTH_CLIENT_SECRET, null);
}

function makeAuthTokens(tokens: OAuth2Tokens): AuthTokens {
    return {
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken(),
        expiresAt: tokens.accessTokenExpiresAt().getTime()
    };
}

export async function getOnshapeApiFromSessionId(
    kv: KVNamespace,
    sessionId: string
): Promise<OAuthApi> {
    const tokens = await getTokens(kv, sessionId);

    const refreshCallback = async () => {
        const oauthClient = getOauthClient();
        const newTokens = await oauthClient
            .refreshAccessToken(TOKEN_ENDPOINT, tokens.refreshToken, [])
            .then((refreshed) => makeAuthTokens(refreshed));

        void saveTokens(kv, sessionId, newTokens);

        return newTokens.accessToken;
    };

    let accessToken = tokens.accessToken;
    // If the token expired in the past, refresh immediately
    if (tokens.expiresAt <= Date.now()) {
        accessToken = await refreshCallback();
    }

    return new OAuthApi(accessToken, refreshCallback);
}

/**
 * Creates/caches an Onshape API instance from the AppContext.
 *
 * Note this function should not be called directly, as it is bound to the context directly.
 */
export async function getOnshapeApi(c: AppContext): Promise<OAuthApi> {
    const cached = c.get("onshapeApi");
    if (cached) return cached;
    const api = await getOnshapeApiFromSessionId(c.env.KV, getSessionId(c));
    c.set("onshapeApi", api);
    return api;
}

function userIdKey(sessionId: string): string {
    return `user-id:${sessionId}`;
}

/** Returns the caller's Onshape user id, memoized in KV by session. */
export async function getCachedUserId(c: AppContext): Promise<string> {
    const key = userIdKey(getSessionId(c));

    const cached = await c.env.KV.get(key);
    if (cached) return cached;

    const userId = await getUserId(await getOnshapeApi(c));
    await c.env.KV.put(key, userId, { expirationTtl: SESSION_TTL });
    return userId;
}

export async function isAuthenticated(c: AppContext): Promise<boolean> {
    try {
        const onshapeApi = await c.var.getOnshapeApi();
        const sessionInfo = await getSessionInfo(onshapeApi);
        const tokenCompanyId = sessionInfo.company?.id ?? "cad";
        return getSessionCompanyId(c) === tokenCompanyId;
    } catch {
        return false;
    }
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
        throw new HTTPException(HttpStatus.UNAUTHORIZED, {
            message: "Invalid response from Onshape"
        });
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
