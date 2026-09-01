import { type MiddlewareHandler } from "hono";
import { internalError } from "./api-error";
import { HttpStatus } from "http-status-ts";
import { type AppContextEnv } from "./context";

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

/** What a policy says, as the header says it. */
function cacheControl(policy: CachePolicy): string {
    return policy === CachePolicy.NO_CACHE
        ? NO_STORE
        : immutableCacheControl(policy);
}

/**
 * Declares how one response may be cached, for a route whose answers differ:
 * the same url can serve bytes it pins and a stand-in it does not. Routes
 * whose every answer is alike take {@link cacheMiddleware} instead.
 */
export function setCache(response: Response, policy: CachePolicy): Response {
    response.headers.set("Cache-Control", cacheControl(policy));
    return response;
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
        c.header("Cache-Control", cacheControl(policy));
    };
}
