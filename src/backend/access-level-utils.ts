import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppContext, type AppContextEnv } from "./app";
import { getOnshapeApi } from "./auth";
import { getAccessLevel } from "./onshape-api/endpoints/users";
import { AccessLevel, hasEditorAccess } from "../shared/types";

export async function getAppAccessLevel(c: AppContext): Promise<AccessLevel> {
    const override = c.env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const onshapeApi = await getOnshapeApi(c);
    return getAccessLevel(onshapeApi, c.env.ADMIN_TEAM);
}

export async function requireEditorAccess(c: AppContext): Promise<void> {
    const onshapeApi = await getOnshapeApi(c);
    const override = c.env.ACCESS_LEVEL_OVERRIDE;
    const level = override
        ? (override as AccessLevel)
        : await getAccessLevel(onshapeApi, c.env.ADMIN_TEAM);
    if (!hasEditorAccess(level)) {
        throw new HTTPException(403, { message: "Insufficient permissions" });
    }
}

export const requireAdminMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireEditorAccess(c);
    await next();
};
