import { HttpStatus } from "http-status-ts";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppContext, type AppContextEnv } from "./app";
import { getOnshapeApi, getSessionId } from "./auth";
import { getAccessLevel } from "./onshape-api/endpoints/users";
import { hasEditorAccess, type AccessLevel } from "../shared/types";

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

async function requireEditorAccess(c: AppContext): Promise<void> {
    const level = await c.var.getAccessLevel();
    if (!hasEditorAccess(level)) {
        throw new HTTPException(HttpStatus.FORBIDDEN, {
            message: "You must be on the admin team to use this functionality"
        });
    }
}

/**
 * Middleware which requires users to be an editor or an admin.
 */
export const requireEditorMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireEditorAccess(c);
    await next();
};
