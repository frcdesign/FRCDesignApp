/** The two gates routes mount: signed in to Onshape at all, and on the admin team. */
import type { MiddlewareHandler } from "hono";
import { handledError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { hasEditorAccess } from "./access-level";
import { isSignedIn } from "./caller";

async function requireSignIn(c: AppContext): Promise<void> {
    if (!(await isSignedIn(c))) {
        throw handledError(
            "You must be signed in to Onshape to use this functionality",
            HttpStatus.UNAUTHORIZED
        );
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
 * Editing implies a session: access level alone would admit a signed-out caller
 * under a dev `ACCESS_LEVEL_OVERRIDE`, and answer 403 rather than 401 otherwise.
 */
export const requireEditorMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireSignIn(c);
    if (!hasEditorAccess(await c.var.getAccessLevel())) {
        throw handledError(
            "You must be on the admin team to use this functionality",
            HttpStatus.FORBIDDEN
        );
    }
    await next();
};
