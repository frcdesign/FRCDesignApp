import { type AppContext } from "./app";
import { getOnshapeApi, getSessionId } from "./auth";
import { getAccessLevel } from "./onshape-api/endpoints/users";
import { type AccessLevel } from "../shared/types";

/** How long a resolved access level is cached in KV. */
const ACCESS_LEVEL_TTL_SECONDS = 60 * 60;

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
