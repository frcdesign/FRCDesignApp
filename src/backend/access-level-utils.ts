import { HttpStatus } from "http-status-ts";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppContext, type AppContextEnv } from "./app";
import { hasEditorAccess } from "../shared/types";

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
