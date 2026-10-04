import type { MiddlewareHandler } from "hono";
import { forbiddenError, signInRequiredError } from "../../lib/api-error";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { getLibraryParam } from "../../lib/route-params";
import { DEFAULT_LIBRARY } from "../library/library-id";
import { AccessLevel, isWithinAccessLevel } from "./access-level";
import { isSignedIn } from "./request-auth";

async function requireSignIn(c: AppContext): Promise<void> {
    if (!(await isSignedIn(c))) {
        throw signInRequiredError(
            "You must be signed in to Onshape to use this functionality."
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
 * For a route under `libraryRoute()`. Requires a session, or a dev override
 * would let a signed-out caller through. A route acting on a group or
 * insertable scopes its query to this library, so it can't reach another's.
 */
function requireLibraryAccess(
    level: AccessLevel.EDITOR | AccessLevel.ADMIN
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        await requireSignIn(c);
        const accessLevel = await c.var.getAccessLevel(getLibraryParam(c));
        if (!isWithinAccessLevel(level, accessLevel)) {
            throw forbiddenError(
                level === AccessLevel.ADMIN
                    ? "You must be an admin of the library's admin team to use this functionality."
                    : "You must be on the library's admin team to use this functionality."
            );
        }
        await next();
    };
}

export const requireEditorMiddleware = requireLibraryAccess(AccessLevel.EDITOR);

export const requireAdminMiddleware = requireLibraryAccess(AccessLevel.ADMIN);

/** The owner's access is the same everywhere, so any library answers. */
export async function requireOwner(c: AppContext): Promise<void> {
    await requireSignIn(c);
    const level = await c.var.getAccessLevel(DEFAULT_LIBRARY);
    if (level !== AccessLevel.OWNER) {
        throw forbiddenError("Only the owner can use this functionality.");
    }
}

export const requireOwnerMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireOwner(c);
    await next();
};
