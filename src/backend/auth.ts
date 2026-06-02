import { generateState, OAuth2Client, OAuth2Tokens } from "arctic";
import { OAuthApi } from "./onshape-api/onshape-api";
import { type AppContext, getApp } from "./app";
import { HTTPException } from "hono/http-exception";
import { getCookie, setCookie } from "hono/cookie";
import { env } from "cloudflare:workers";
import { ping } from "./onshape-api/endpoints/users";

const SESSION_COOKIE = "frc-design-app-cookie";
const LOGIN_TTL = 600; // 10 minutes
const SESSION_TTL = 30 * 24 * 3600; // 30 days

export function getSessionId(c: AppContext): string {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
        throw new HTTPException(401, {
            message: "Failed to find a valid session"
        });
    }
    return sessionId;
}

export async function getOnshapeApiForSessionId(
    kv: KVNamespace,
    sessionId: string
): Promise<OAuthApi> {
    const tokens = await getTokens(kv, sessionId);

    const refreshCallback = async () => {
        const oauthClient = getOauthClient();
        const newTokens = await oauthClient
            .refreshAccessToken(TOKEN_ENDPOINT, tokens.refreshToken, [])
            .then(makeAuthTokens);

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

export async function isAuthenticated(c: AppContext) {
    try {
        const onshapeApi = await getOnshapeApi(c);
        return ping(onshapeApi);
    } catch {
        return false;
    }
}

export async function getOnshapeApi(c: AppContext): Promise<OAuthApi> {
    const cached = c.get("onshapeApi");
    if (cached) return cached;
    const sessionId = getSessionId(c);
    const api = await getOnshapeApiForSessionId(c.env.KV, sessionId);
    c.set("onshapeApi", api);
    return api;
}

function getOauthClient(): OAuth2Client {
    return new OAuth2Client(env.OAUTH_CLIENT_ID, env.OAUTH_CLIENT_SECRET, null);
}

const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";

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
        throw new HTTPException(400, {
            message: "Failed to find valid redirectUrl"
        });
    }

    const authorizationUrl = await doSignIn(c, redirectUrl);
    return c.redirect(authorizationUrl);
});

authRoutes.get("/callback", async (c) => {
    return doCallback(c);
});

/**
 * Stores the redirectUrl and state.
 *
 * Returns the URL the user should be redirected to.
 */
export async function doSignIn(
    c: AppContext,
    redirectUrl: string
): Promise<string> {
    const oauthClient = getOauthClient();

    const state = generateState();

    // Store the state and redirectUrl
    await initSession(c, { state, redirectUrl });

    return oauthClient
        .createAuthorizationURL(AUTH_ENDPOINT, state, [])
        .toString();
}

export async function doCallback(c: AppContext): Promise<Response> {
    const search = c.req.query() as Record<string, string | undefined>;

    // The user clicked "Deny access" on the sign in page
    if (search.error === "access_denied") {
        return c.redirect("/grant-denied");
    }

    const session = await getSession(c);

    // There was a problem with the cookie used to store redirect information
    if (!session) {
        if (isSafari(c.req.raw)) {
            return c.redirect("/safari-error");
        }
        return c.redirect("/cookie-error");
    }

    if (!search.code || session.state !== search.state) {
        throw new HTTPException(401, {
            message: "Invalid response from Onshape"
        });
    }

    const oauthClient = getOauthClient();

    await oauthClient
        .validateAuthorizationCode(TOKEN_ENDPOINT, search.code, null)
        .then(makeAuthTokens)
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

interface OAuthSessionData {
    state: string;
    redirectUrl: string;
}

async function getSession(
    c: AppContext
): Promise<(OAuthSessionData & { sessionId: string }) | null> {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) return null;
    const raw = await c.env.KV.get(`login-session:${sessionId}`);
    if (!raw) return null;

    const session = JSON.parse(raw);
    session.sessionId = sessionId;

    void c.env.KV.delete(`login-session:${sessionId}`);
    return session;
}

async function initSession(
    c: AppContext,
    data: OAuthSessionData
): Promise<string> {
    const sessionId = crypto.randomUUID();
    // SameSite=none + secure required because the app runs embedded in an Onshape iframe
    setCookie(c, SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/",
        maxAge: SESSION_TTL
    });

    await c.env.KV.put(`login-session:${sessionId}`, JSON.stringify(data), {
        expirationTtl: LOGIN_TTL
    });
    return sessionId;
}
interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

function makeAuthTokens(tokens: OAuth2Tokens): AuthTokens {
    return {
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken(),
        expiresAt: tokens.accessTokenExpiresAt().getTime()
    };
}

/**
 * Saves a set of tokens into KV.
 */
async function saveTokens(
    kv: KVNamespace,
    sessionId: string,
    tokens: AuthTokens
) {
    const tokenString = JSON.stringify(tokens);
    await kv.put(`tokens:${sessionId}`, tokenString, {
        expirationTtl: SESSION_TTL
    });
}

/**
 * Retrieves a set of tokens from KV.
 */
async function getTokens(
    kv: KVNamespace,
    sessionId: string
): Promise<AuthTokens> {
    const raw = await kv.get(`tokens:${sessionId}`);
    if (!raw) {
        throw new HTTPException(401, {
            message: "Failed to find valid auth tokens to use"
        });
    }
    return JSON.parse(raw) as AuthTokens;
}
