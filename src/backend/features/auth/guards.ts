/** The two gates routes mount: signed in to Onshape at all, and on the admin team. */
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import type { AppContextEnv } from "../../lib/context";
import { hasEditorAccess } from "./access-level";
import { isSignedIn } from "./caller";

export const requireSignInMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    if (!(await isSignedIn(c))) {
        throw new HTTPException(HttpStatus.UNAUTHORIZED, {
            message:
                "You must be signed in to Onshape to use this functionality"
        });
    }
    await next();
};

export const requireEditorMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    if (!hasEditorAccess(await c.var.getAccessLevel())) {
        throw new HTTPException(HttpStatus.FORBIDDEN, {
            message: "You must be on the admin team to use this functionality"
        });
    }
    await next();
};
