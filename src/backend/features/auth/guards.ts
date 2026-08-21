/** The two gates routes mount: signed in to Onshape at all, and on the admin team. */
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { hasEditorAccess } from "./access-level";
import { isSignedIn } from "./caller";

async function requireSignIn(c: AppContext): Promise<void> {
    if (!(await isSignedIn(c))) {
        throw new HTTPException(HttpStatus.UNAUTHORIZED, {
            message:
                "You must be signed in to Onshape to use this functionality"
        });
    }
}

export const requireSignInMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireSignIn(c);
    await next();
};

/**
 * Editing implies a session: access level alone would let a signed-out caller
 * through wherever it is granted without one (a dev `ACCESS_LEVEL_OVERRIDE`),
 * and would answer 403 rather than 401 for everyone else.
 */
export const requireEditorMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireSignIn(c);
    if (!hasEditorAccess(await c.var.getAccessLevel())) {
        throw new HTTPException(HttpStatus.FORBIDDEN, {
            message: "You must be on the admin team to use this functionality"
        });
    }
    await next();
};
