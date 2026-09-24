/**
 * Work nobody is signed in behind, like a webhook's load, still calls Onshape
 * as someone: the owner or one of the library's team admins, whoever still has
 * a session Onshape takes. Only their sessions are kept by user id.
 */
import { type OAuthApi } from "../../lib/onshape/client";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { libraries } from "../../db/schema";
import { inArray } from "drizzle-orm";
import type { LibraryId } from "../library/library-id";
import { getOnshapeApiFromSessionId } from "./request-auth";
import { kvStore } from "../../lib/kv-store";

/** Each admin's latest session id, by user id. */
const adminSessions = kvStore<string>("admin-session");

/** Only writes when the session changed. */
export async function rememberAdminSession(
    kv: KVNamespace,
    userId: string,
    sessionId: string
): Promise<void> {
    if ((await adminSessions.get(kv, userId)) !== sessionId) {
        await adminSessions.put(kv, userId, sessionId);
    }
}

async function getLiveApi(
    kv: KVNamespace,
    userId: string
): Promise<OAuthApi | undefined> {
    const sessionId = await adminSessions.get(kv, userId);
    if (!sessionId) {
        return undefined;
    }
    try {
        const onshapeApi = await getOnshapeApiFromSessionId(kv, sessionId);
        // Refreshing proves the refresh token; this proves the access token.
        await getSessionInfo(onshapeApi);
        return onshapeApi;
    } catch {
        return undefined;
    }
}

/** The owner's session, else the first working one of the libraries' team admins. */
export async function getAdminOnshapeApi(
    env: AppBindings,
    libraryIds: LibraryId[]
): Promise<OAuthApi | undefined> {
    const owner = env.OWNER_USER_ID
        ? await getLiveApi(env.KV, env.OWNER_USER_ID)
        : undefined;
    if (owner || libraryIds.length === 0) {
        return owner;
    }
    const rows = await getDb(env.DB)
        .select({ adminTeam: libraries.adminTeam })
        .from(libraries)
        .where(inArray(libraries.id, libraryIds));
    const admins = new Set(
        rows.flatMap((row) =>
            row.adminTeam
                .filter((member) => member.isTeamAdmin)
                .map((member) => member.userId)
        )
    );
    for (const userId of admins) {
        const api = await getLiveApi(env.KV, userId);
        if (api) {
            return api;
        }
    }
    return undefined;
}
