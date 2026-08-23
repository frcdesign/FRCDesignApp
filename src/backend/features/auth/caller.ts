/**
 * Resolves who is calling from their session, memoizing the Onshape lookups in
 * KV. `productionCaller` is what `createApp` binds onto every request; the
 * guards and routes read the results through `c.var`.
 */
import { env as processEnv } from "process";
import { OAuthApi } from "../../lib/onshape/client";
import {
    getAccessLevel,
    getSessionInfo,
    getUserId
} from "../../lib/onshape/endpoints/users";
import { type AppContext, type CallerFactory } from "../../lib/context";
import { AccessLevel } from "./access-level";
import {
    getOauthClient,
    makeAuthTokens,
    TOKEN_ENDPOINT
} from "./onshape-oauth";
import {
    getSession,
    getSessionCompanyId,
    getSessionId,
    saveSession
} from "./session";

/** How long a resolved access level is cached in KV. */
const ACCESS_LEVEL_TTL_SECONDS = 60 * 60;

/** Stable fake user id used for FORCE_SIGNED_IN testing sessions. */
export const FORCE_SIGNED_IN_USER_ID = "force-signed-in-user";

export async function getOnshapeApiFromSessionId(
    kv: KVNamespace,
    sessionId: string
): Promise<OAuthApi> {
    const session = await getSession(kv, sessionId);

    const refreshCallback = async () => {
        const oauthClient = getOauthClient();
        const newTokens = await oauthClient
            .refreshAccessToken(TOKEN_ENDPOINT, session.refreshToken, [])
            .then((refreshed) => makeAuthTokens(refreshed));

        // Spread, so a refresh keeps the userId the session already resolved.
        void saveSession(kv, sessionId, { ...session, ...newTokens });

        return newTokens.accessToken;
    };

    let accessToken = session.accessToken;
    // If the token expired in the past, refresh immediately
    if (session.expiresAt <= Date.now()) {
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

/** Returns the caller's Onshape user id, resolved once and kept on the session. */
export async function getCachedUserId(c: AppContext): Promise<string> {
    const sessionId = getSessionId(c);
    const session = await getSession(c.env.KV, sessionId);
    if (session.userId) return session.userId;

    const userId = await getUserId(await getOnshapeApi(c));
    await saveSession(c.env.KV, sessionId, { ...session, userId });
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

/** FORCE_SIGNED_IN is a dev-only escape hatch, ignored in production. */
export function isForceSignedIn(c: AppContext): boolean {
    return !!c.env.FORCE_SIGNED_IN && processEnv.NODE_ENV !== "production";
}

/**
 * Whether the caller has a valid Onshape session, memoized on the request.
 * `FORCE_SIGNED_IN` forces it true for testing.
 */
export async function isSignedIn(c: AppContext): Promise<boolean> {
    const cached = c.get("signedIn");
    if (cached !== undefined) return cached;

    let signedIn: boolean;
    if (isForceSignedIn(c)) {
        signedIn = true;
    } else {
        try {
            await c.var.getOnshapeApi();
            signedIn = true;
        } catch {
            signedIn = false;
        }
    }

    c.set("signedIn", signedIn);
    return signedIn;
}

function accessLevelKey(sessionId: string): string {
    return `access-level:${sessionId}`;
}

/** Returns the caller's access level, memoized in KV by session. */
export async function getCachedAccessLevel(
    c: AppContext
): Promise<AccessLevel> {
    const key = accessLevelKey(getSessionId(c));

    const cached = await c.env.KV.get(key);
    if (cached) return cached as AccessLevel;

    const level = await getAccessLevel(
        await getOnshapeApi(c),
        c.env.ADMIN_TEAM
    );
    await c.env.KV.put(key, level, {
        expirationTtl: ACCESS_LEVEL_TTL_SECONDS
    });
    return level;
}

/**
 * Production wiring. getUserId only runs behind requireSignInMiddleware;
 * getAccessLevel falls back to USER for anyone without a real Onshape session.
 */
export const productionCaller: CallerFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => {
        // FORCE_SIGNED_IN has no real Onshape session; use a stable fake id.
        if (isForceSignedIn(c)) {
            return Promise.resolve(FORCE_SIGNED_IN_USER_ID);
        }
        return getCachedUserId(c);
    },
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        // getCachedAccessLevel needs a real Onshape session, so only call it
        // for a genuinely signed-in caller (not FORCE_SIGNED_IN).
        if (!isForceSignedIn(c) && (await isSignedIn(c))) {
            return getCachedAccessLevel(c);
        }
        return AccessLevel.USER;
    },
    isAuthenticated: () => isAuthenticated(c)
});
