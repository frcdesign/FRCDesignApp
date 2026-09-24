/**
 * The gates routes mount: signed in to Onshape at all, on a library's admin
 * team, and the owner.
 */
import type { MiddlewareHandler } from "hono";
import {
    forbiddenError,
    handledError,
    signInRequiredError
} from "../../lib/api-error";
import type { AppContext, AppContextEnv } from "../../lib/context";
import { getLibraryParam } from "../../lib/route-params";
import { DEFAULT_LIBRARY, type LibraryId } from "../library/library-id";
import { AccessLevel, hasEditorAccess } from "./access-level";
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
 * Editing a library takes a place on its admin team. `libraryOf` is for a route
 * naming something inside a library rather than the library: the library is
 * looked up from it, not taken from the caller, whose word it would otherwise
 * be. Editing implies a session: access level alone would admit a signed-out
 * caller under a dev access-level override, and answer 403 rather than 401.
 */
export function requireEditor(
    libraryOf: LibraryOf = libraryParam
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        await requireSignIn(c);
        const libraryId = await libraryOf(c);
        if (!libraryId) {
            throw handledError("Not found", HttpStatus.NOT_FOUND);
        }
        if (!hasEditorAccess(await c.var.getAccessLevel(libraryId))) {
            throw forbiddenError(
                "You must be on the library's admin team to use this functionality"
            );
        }
        await next();
    };
}

/** For a route under `libraryRoute()`. */
export const requireEditorMiddleware = requireEditor();

/**
 * For what reaches past any one library. The owner's access is the same in
 * every library, so any library answers.
 */
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
