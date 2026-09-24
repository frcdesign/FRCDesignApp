/**
 * Work the server starts on its own, like a webhook load, still calls Onshape
 * as someone, so each user's latest session is kept by their Onshape id.
 */
import { type OAuthApi } from "../../lib/onshape/client";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import type { AppBindings } from "../../lib/context";
import { getOnshapeApiFromSessionId } from "./request-auth";

function userSessionKey(userId: string): string {
    return `user-session:${userId}`;
}

/** Only writes when the session changed. */
export async function rememberUserSession(
    kv: KVNamespace,
    userId: string,
    sessionId: string
): Promise<void> {
    const key = userSessionKey(userId);
    if ((await kv.get(key)) !== sessionId) {
        await kv.put(key, sessionId);
    }
}

export interface UserSession {
    sessionId: string;
    onshapeApi: OAuthApi;
}

/** The user's latest session, if Onshape still takes it. */
export async function getLiveSession(
    kv: KVNamespace,
    userId: string
): Promise<UserSession | undefined> {
    const sessionId = await kv.get(userSessionKey(userId));
    if (!sessionId) {
        return undefined;
    }
    try {
        const onshapeApi = await getOnshapeApiFromSessionId(kv, sessionId);
        // Refreshing proves the refresh token; this proves the access token.
        await getSessionInfo(onshapeApi);
        return { sessionId, onshapeApi };
    } catch {
        return undefined;
    }
}

export async function getOwnerSession(
    env: AppBindings
): Promise<UserSession | undefined> {
    return env.OWNER_USER_ID
        ? getLiveSession(env.KV, env.OWNER_USER_ID)
        : undefined;
}
