import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppContext, type AppContextEnv } from "./app";

/**
 * Whether the caller has a valid Onshape session, memoized on the request.
 *
 * Resolves through the injected `getOnshapeApi` (which needs a session cookie +
 * valid tokens), so it honors test/standalone wiring. `FORCE_SIGNED_IN` forces
 * it true for testing (see services.ts for the matching fake userId).
 */
export async function isSignedIn(c: AppContext): Promise<boolean> {
    const cached = c.get("signedIn");
    if (cached !== undefined) return cached;

    let signedIn: boolean;
    if (c.env.FORCE_SIGNED_IN) {
        signedIn = true;
    } else {
        try {
            await c.var.getOnshapeApi();
            signedIn = true;
        } catch {
            signedIn = false;
        }
    }

    c.set("signedIn", signedIn);
    return signedIn;
}

/**
 * Middleware which requires the caller to be signed in to Onshape.
 */
export const requireSignInMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    if (!(await isSignedIn(c))) {
        throw new HTTPException(401, {
            message:
                "You must be signed in to Onshape to use this functionality"
        });
    }
    await next();
};
