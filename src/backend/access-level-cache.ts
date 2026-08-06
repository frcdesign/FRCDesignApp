import { type AppContext } from "./app";
import { getOnshapeApi, getSessionId } from "./auth";
import { getAccessLevel } from "./onshape-api/endpoints/users";
import { type AccessLevel } from "../shared/types";

/**
 * How long a resolved access level is cached in KV. A single window for every
 * result — this app's admin team changes membership rarely, so a ~1 hour
 * propagation delay (a removed admin loses access, a newly added one gains it,
 * within the hour) is an acceptable trade for taking the Onshape `teams` lookup
 * off nearly every request. Dial down if faster propagation is ever needed.
 */
const ACCESS_LEVEL_TTL_SECONDS = 60 * 60;

function accessLevelKey(sessionId: string): string {
    return `access-level:${sessionId}`;
}

/**
 * Resolves the caller's access level, memoized in KV by session so frequent
 * requests (e.g. polling the library-jobs endpoint) don't each hit Onshape.
 * Falls back to a live lookup if KV is unavailable.
 */
export async function getCachedAccessLevel(
    c: AppContext
): Promise<AccessLevel> {
    const key = accessLevelKey(getSessionId(c));

    try {
        const cached = await c.env.KV.get(key);
        if (cached) return cached as AccessLevel;
    } catch {
        // KV read failed — fall through to a live lookup.
    }

    const level = await getAccessLevel(
        await getOnshapeApi(c),
        c.env.ADMIN_TEAM
    );

    try {
        await c.env.KV.put(key, level, {
            expirationTtl: ACCESS_LEVEL_TTL_SECONDS
        });
    } catch {
        // Best-effort cache; a failed write just means the next request re-checks.
    }

    return level;
}
