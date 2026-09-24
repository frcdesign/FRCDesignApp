import type { MiddlewareHandler } from "hono";
import {
    forbiddenError,
    handledError,
    signInRequiredError
} from "../../lib/api-error";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { getLibraryParam } from "../../lib/route-params";
import { DEFAULT_LIBRARY, type LibraryId } from "../library/library-id";
import { AccessLevel, isWithinAccessLevel } from "./access-level";
import { isSignedIn } from "./request-auth";
import { HttpStatus } from "http-status-ts";

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

/** Which library a request acts on; undefined when what it names is gone. */
type LibraryOf = (c: AppContext) => Promise<LibraryId | undefined>;

const libraryParam: LibraryOf = (c) => Promise.resolve(getLibraryParam(c));

/**
 * `libraryOf` looks the library up from what the route names, rather than
 * trusting the caller. Requires a session, or a dev override would let a
 * signed-out caller through.
 */
function requireLibraryAccess(
    level: AccessLevel.EDITOR | AccessLevel.ADMIN,
    libraryOf: LibraryOf
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        await requireSignIn(c);
        const libraryId = await libraryOf(c);
        if (!libraryId) {
            throw handledError("Not found", HttpStatus.NOT_FOUND);
        }
        if (
            !isWithinAccessLevel(level, await c.var.getAccessLevel(libraryId))
        ) {
            throw forbiddenError(
                level === AccessLevel.ADMIN
                    ? "You must be an admin of the library's admin team to use this functionality"
                    : "You must be on the library's admin team to use this functionality"
            );
        }
        await next();
    };
}

export function requireEditor(
    libraryOf: LibraryOf = libraryParam
): MiddlewareHandler<AppContextEnv> {
    return requireLibraryAccess(AccessLevel.EDITOR, libraryOf);
}

/** For a route under `libraryRoute()`. */
export const requireEditorMiddleware = requireEditor();

/** For a route under `libraryRoute()`. */
export const requireAdminMiddleware = requireLibraryAccess(
    AccessLevel.ADMIN,
    libraryParam
);

/** The owner's access is the same everywhere, so any library answers. */
export const requireOwnerMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await requireSignIn(c);
    const level = await c.var.getAccessLevel(
        c.req.param("libraryId") ? getLibraryParam(c) : DEFAULT_LIBRARY
    );
    if (level !== AccessLevel.OWNER) {
        throw forbiddenError("Only the owner can use this functionality");
    }
    await next();
};
