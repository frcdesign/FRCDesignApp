/** `createApp` binds `productionAuth` onto every request; routes ask through `c.var`. */
import { env as processEnv } from "process";
import { OAuthApi } from "../../lib/onshape/client";
import { getSessionInfo, getUserId } from "../../lib/onshape/endpoints/users";
import { type AppContext, type AuthResolver } from "../../lib/context";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { adminTeamMembers } from "../../db/schema";
import type { LibraryId } from "../library/library-id";
import { AccessLevel } from "./access-level";
import { rememberUserSession } from "./user-sessions";
import {
    getOauthClient,
    makeAuthTokens,
    TOKEN_ENDPOINT
} from "./onshape-oauth";
import {
    getSession,
    getSessionCompanyId,
    getSessionId,
    PERSONAL_COMPANY_ID,
    saveSession
} from "./session";

/** Stable fake user id used for FORCE_SIGNED_IN testing sessions. */
const FORCE_SIGNED_IN_USER_ID = "force-signed-in-user";

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

        // Awaited: a cancelled write leaves the old token, so every request refreshes.
        await saveSession(kv, sessionId, { ...session, ...newTokens });

        return newTokens.accessToken;
    };

    let accessToken = session.accessToken;
    // If the token expired in the past, refresh immediately
    if (session.expiresAt <= Date.now()) {
        accessToken = await refreshCallback();
    }

    return new OAuthApi(accessToken, refreshCallback);
}

/** Cached on the context; call it through `c.var`. */
export async function getOnshapeApi(c: AppContext): Promise<OAuthApi> {
    const cached = c.get("onshapeApi");
    if (cached) return cached;
    const api = await getOnshapeApiFromSessionId(c.env.KV, getSessionId(c));
    c.set("onshapeApi", api);
    return api;
}

/** Takes a session id, since work a request starts can outlive it. */
async function getUserIdFromSessionId(
    kv: KVNamespace,
    sessionId: string
): Promise<string> {
    const session = await getSession(kv, sessionId);
    if (session.userId) return session.userId;

    const userId = await getUserId(
        await getOnshapeApiFromSessionId(kv, sessionId)
    );
    await saveSession(kv, sessionId, { ...session, userId });
    return userId;
}

/** Returns the caller's Onshape user id, resolved once and kept on the session. */
function getCachedUserId(c: AppContext): Promise<string> {
    return getUserIdFromSessionId(c.env.KV, getSessionId(c));
}

export async function isAuthenticated(c: AppContext): Promise<boolean> {
    try {
        const onshapeApi = await c.var.getOnshapeApi();
        const sessionInfo = await getSessionInfo(onshapeApi);
        // Onshape reports no company outside an enterprise.
        const tokenCompanyId = sessionInfo.company?.id ?? PERSONAL_COMPANY_ID;
        return getSessionCompanyId(c) === tokenCompanyId;
    } catch {
        return false;
    }
}

/** The dev-only escape hatches are ignored in production. */
function isDevelopment(): boolean {
    return processEnv.NODE_ENV !== "production";
}

function isForceSignedIn(c: AppContext): boolean {
    return !!c.env.FORCE_SIGNED_IN && isDevelopment();
}

/** The access level granted without asking Onshape, in dev only. */
function getAccessLevelOverride(c: AppContext): AccessLevel | undefined {
    if (!isDevelopment()) {
        return undefined;
    }
    return c.env.VITE_ACCESS_LEVEL_OVERRIDE as AccessLevel | undefined;
}

/** Whether the session resolves to tokens Onshape will take. */
async function hasOnshapeSession(c: AppContext): Promise<boolean> {
    try {
        await c.var.getOnshapeApi();
        return true;
    } catch {
        return false;
    }
}

/** Memoized on the request. */
export async function isSignedIn(c: AppContext): Promise<boolean> {
    const cached = c.get("signedIn");
    if (cached !== undefined) return cached;

    const signedIn = isForceSignedIn(c) || (await hasOnshapeSession(c));
    c.set("signedIn", signedIn);
    return signedIn;
}

/** The owner's anywhere; otherwise the library's admin team as last synced. */
async function getLibraryAccessLevel(
    c: AppContext,
    libraryId: LibraryId
): Promise<AccessLevel> {
    const userId = await getCachedUserId(c);
    await rememberUserSession(c.env.KV, userId, getSessionId(c));
    if (c.env.OWNER_USER_ID && userId === c.env.OWNER_USER_ID) {
        return AccessLevel.OWNER;
    }
    const member = await getDb(c.env.DB)
        .select({ isTeamAdmin: adminTeamMembers.isTeamAdmin })
        .from(adminTeamMembers)
        .where(
            and(
                eq(adminTeamMembers.libraryId, libraryId),
                eq(adminTeamMembers.userId, userId)
            )
        )
        .get();
    if (!member) {
        return AccessLevel.USER;
    }
    return member.isTeamAdmin ? AccessLevel.ADMIN : AccessLevel.EDITOR;
}

/** getAccessLevel falls back to USER without a real session. */
export const productionAuth: AuthResolver = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => {
        // FORCE_SIGNED_IN has no real Onshape session; use a stable fake id.
        if (isForceSignedIn(c)) {
            return Promise.resolve(FORCE_SIGNED_IN_USER_ID);
        }
        return getCachedUserId(c);
    },
    getAccessLevel: async (libraryId) => {
        const override = getAccessLevelOverride(c);
        if (override) return override;
        // FORCE_SIGNED_IN has no real session to identify the caller.
        if (!isForceSignedIn(c) && (await isSignedIn(c))) {
            return getLibraryAccessLevel(c, libraryId);
        }
        return AccessLevel.USER;
    },
    isAuthenticated: () => isAuthenticated(c)
});
