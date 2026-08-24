import { type MiddlewareHandler } from "hono";
import { internalError } from "./api-error";
import { HttpStatus } from "http-status-ts";
import { type AppContext, type AppContextEnv } from "./context";

/** A year — a versioned url's content never changes, only its version does. */
const IMMUTABLE_CACHE_TTL = 365 * 24 * 3600;

const NO_STORE = "private, no-store";

export enum CachePolicy {
    /** Never stored, anywhere. */
    NO_CACHE = "no-cache",
    /** Immutable, but kept out of shared caches. */
    PRIVATE_CACHE = "private",
    /** Immutable and the same for every caller. */
    PUBLIC_CACHE = "public"
}

export function immutableCacheControl(
    policy: CachePolicy.PRIVATE_CACHE | CachePolicy.PUBLIC_CACHE
): string {
    return `${policy}, max-age=${IMMUTABLE_CACHE_TTL}, immutable`;
}

/** Overrides the route's immutable default for a body its url does not pin. */
export function setCacheTtl(c: AppContext, maxAge: number): void {
    c.set("cacheTtl", maxAge);
}

/** Declares how a route's response may be cached, and enforces what that takes. */
export function cacheMiddleware(
    policy: CachePolicy = CachePolicy.NO_CACHE
): MiddlewareHandler<AppContextEnv> {
    if (policy === CachePolicy.NO_CACHE) {
        return async (c, next) => {
            await next();
            c.header("Cache-Control", NO_STORE);
        };
    }

    const cacheControl = immutableCacheControl(policy);

    return async (c, next) => {
        // An immutable response has to be pinned by something, or the next
        // version of it is unreachable behind the cache.
        if (!c.req.query("v")) {
            throw internalError(
                "Missing cache version",
                HttpStatus.BAD_REQUEST
            );
        }
        await next();
        // A miss must stay retryable, so only store what succeeded.
        if (!c.res.ok) {
            c.header("Cache-Control", NO_STORE);
            return;
        }
        const ttl = c.get("cacheTtl");
        c.header(
            "Cache-Control",
            ttl === undefined ? cacheControl : `${policy}, max-age=${ttl}`
        );
    };
}
