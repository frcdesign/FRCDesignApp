import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { env } from "process";
import type { AppContext, AppContextEnv } from "../../lib/context";

/** FORCE_SIGNED_IN is a dev-only escape hatch, ignored in production. */
export function isForceSignedIn(c: AppContext): boolean {
    return !!c.env.FORCE_SIGNED_IN && env.NODE_ENV !== "production";
}

/**
 * Whether the caller has a valid Onshape session, memoized on the request.
 * `FORCE_SIGNED_IN` forces it true for testing (see services.ts).
 */
export async function isSignedIn(c: AppContext): Promise<boolean> {
    const cached = c.get("signedIn");
    if (cached !== undefined) return cached;

    let signedIn: boolean;
    if (isForceSignedIn(c)) {
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
        throw new HTTPException(HttpStatus.UNAUTHORIZED, {
            message:
                "You must be signed in to Onshape to use this functionality"
        });
    }
    await next();
};
