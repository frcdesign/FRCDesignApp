import type { MiddlewareHandler } from "hono";
import { type AppContextEnv } from "./app";
import { getOnshapeApi } from "./auth";
import { getUserId } from "./onshape-api/endpoints/users";

/**
 * Resolves the session's {@link OAuthApi} and stores it on the context as
 * `onshapeApi`.
 */
export const onshapeApiMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    c.set("onshapeApi", await getOnshapeApi(c));
    await next();
};

/**
 * Resolves the current user's id and stores it on the context as `userId`.
 *
 * Requires {@link onshapeApiMiddleware} to have run first.
 */
export const userIdMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    c.set("userId", await getUserId(c.var.onshapeApi));
    await next();
};
