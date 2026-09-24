/** The two gates routes mount: signed in to Onshape at all, and on the admin team. */
import type { MiddlewareHandler } from "hono";
import { forbiddenError, signInRequiredError } from "../../lib/api-error";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { hasEditorAccess } from "./access-level";
import { isSignedIn } from "./request-auth";

async function requireSignIn(c: AppContext): Promise<void> {
    if (!(await isSignedIn(c))) {
        throw signInRequiredError(
            "You must be signed in to Onshape to use this functionality"
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
 * under a dev access-level override, and answer 403 rather than 401 otherwise.
 */
export const requireEditorMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireSignIn(c);
    if (!hasEditorAccess(await c.var.getAccessLevel())) {
        throw forbiddenError(
            "You must be on the admin team to use this functionality"
        );
    }
    await next();
};
