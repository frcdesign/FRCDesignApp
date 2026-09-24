/**
 * Work the server starts on its own, like a webhook load, still calls Onshape
 * as someone, so it borrows the owner's last session.
 */
import { type OAuthApi } from "../../lib/onshape/client";
import { getOnshapeApiFromSessionId } from "./request-auth";

const OWNER_SESSION_KEY = "owner-session";

/** Only writes when the session changed. */
export async function rememberOwnerSession(
    kv: KVNamespace,
    sessionId: string
): Promise<void> {
    if ((await kv.get(OWNER_SESSION_KEY)) !== sessionId) {
        await kv.put(OWNER_SESSION_KEY, sessionId);
    }
}

/** Can have expired, in which case Onshape calls fail until the owner next opens the app. */
export async function getOwnerSessionId(
    kv: KVNamespace
): Promise<string | undefined> {
    return (await kv.get(OWNER_SESSION_KEY)) ?? undefined;
}

export async function getOwnerOnshapeApi(
    kv: KVNamespace
): Promise<OAuthApi | undefined> {
    const sessionId = await getOwnerSessionId(kv);
    return sessionId ? getOnshapeApiFromSessionId(kv, sessionId) : undefined;
}
