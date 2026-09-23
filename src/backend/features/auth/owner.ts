/**
 * The owner's session, kept for work the server starts on its own. A webhook
 * has nobody signed in behind it, but loading a document calls Onshape as
 * someone, so it borrows the session the owner last used the app with.
 */
import { type OAuthApi } from "../../lib/onshape/client";
import { getOnshapeApiFromSessionId } from "./request-auth";

const OWNER_SESSION_KEY = "owner-session";

/** Called as the owner's access level is resolved, which a new sign-in does. */
export async function rememberOwnerSession(
    kv: KVNamespace,
    sessionId: string
): Promise<void> {
    await kv.put(OWNER_SESSION_KEY, sessionId);
}

/**
 * The owner's last session, or null when they have never used the app. It can
 * have ended since — signed out, or unused past its lifetime — in which case
 * calling Onshape with it fails until they next open the app.
 */
export function getOwnerSessionId(kv: KVNamespace): Promise<string | null> {
    return kv.get(OWNER_SESSION_KEY);
}

export async function getOwnerOnshapeApi(
    kv: KVNamespace
): Promise<OAuthApi | undefined> {
    const sessionId = await getOwnerSessionId(kv);
    return sessionId ? getOnshapeApiFromSessionId(kv, sessionId) : undefined;
}
