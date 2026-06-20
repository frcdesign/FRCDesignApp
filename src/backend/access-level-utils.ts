import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppContext, type AppContextEnv } from "./app";
import { hasEditorAccess } from "../shared/types";

export async function requireEditorAccess(c: AppContext): Promise<void> {
    const level = await c.var.getAccessLevel();
    if (!hasEditorAccess(level)) {
        throw new HTTPException(403, {
            message: "You must be on the admin team to use this functionality"
        });
    }
}

export const requireAdminMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireEditorAccess(c);
    await next();
};
