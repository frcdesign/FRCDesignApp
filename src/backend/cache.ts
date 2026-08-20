import { type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import z from "zod";
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

const cacheVersionSchema = z.object({ v: z.string().min(1) });

interface CacheOptions {
    /** Pass false only when the url is immutable without a `?v=`. */
    versioned?: boolean;
}

/** Overrides the route's immutable default for a body its url does not pin. */
export function setCacheTtl(c: AppContext, maxAge: number): void {
    c.set("cacheTtl", maxAge);
}

/** Declares how a route's response may be cached, and enforces what that takes. */
export function cacheMiddleware(
    policy: CachePolicy = CachePolicy.NO_CACHE,
    options: CacheOptions = {}
): MiddlewareHandler<AppContextEnv> {
    if (policy === CachePolicy.NO_CACHE) {
        return async (c, next) => {
            await next();
            c.header("Cache-Control", NO_STORE);
        };
    }

    const cacheControl = immutableCacheControl(policy);
    const versioned = options.versioned ?? true;

    return async (c, next) => {
        if (versioned && !cacheVersionSchema.safeParse(c.req.query()).success) {
            throw new HTTPException(HttpStatus.BAD_REQUEST, {
                message: "Missing cache version"
            });
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
