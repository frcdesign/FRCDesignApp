/**
 * Work nobody is signed in behind, like a webhook's load, still calls Onshape
 * as someone: the owner or a member of the library's admin team, whoever still
 * has a session Onshape takes. Only their sessions are kept by user id.
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

/** Each eligible user's latest session id, by user id. */
const backgroundSessions = kvStore<string>("background-session");

/**
 * The dev access-level override grants access to someone on no team, so no
 * user id finds them; their session is held under this instead. Only dev writes it.
 */
const OVERRIDDEN_USER = "access-level-override";

/** Only writes when the session changed. */
export async function rememberBackgroundSession(
    kv: KVNamespace,
    userId: string,
    sessionId: string
): Promise<void> {
    if ((await backgroundSessions.get(kv, userId)) !== sessionId) {
        await backgroundSessions.put(kv, userId, sessionId);
    }
}

export function rememberOverriddenSession(
    kv: KVNamespace,
    sessionId: string
): Promise<void> {
    return rememberBackgroundSession(kv, OVERRIDDEN_USER, sessionId);
}

async function getLiveApi(
    kv: KVNamespace,
    userId: string
): Promise<OAuthApi | undefined> {
    const sessionId = await backgroundSessions.get(kv, userId);
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

/**
 * The owner's session, else the first working one of the libraries' team
 * admins, then team members, else an overridden user's.
 */
export async function getBackgroundOnshapeApi(
    env: AppBindings,
    libraryIds: LibraryId[]
): Promise<OAuthApi | undefined> {
    const owner = env.OWNER_USER_ID
        ? await getLiveApi(env.KV, env.OWNER_USER_ID)
        : undefined;
    return (
        owner ??
        (await getTeamApi(env, libraryIds)) ??
        (await getLiveApi(env.KV, OVERRIDDEN_USER))
    );
}

async function getTeamApi(
    env: AppBindings,
    libraryIds: LibraryId[]
): Promise<OAuthApi | undefined> {
    if (libraryIds.length === 0) {
        return undefined;
    }
    const rows = await getDb(env.DB)
        .select({ adminTeam: libraries.adminTeam })
        .from(libraries)
        .where(inArray(libraries.id, libraryIds));
    const members = rows.flatMap((row) => row.adminTeam);
    const userIds = new Set([
        ...members.filter((m) => m.isTeamAdmin).map((m) => m.userId),
        ...members.filter((m) => !m.isTeamAdmin).map((m) => m.userId)
    ]);
    for (const userId of userIds) {
        const api = await getLiveApi(env.KV, userId);
        if (api) {
            return api;
        }
    }
    return undefined;
}
