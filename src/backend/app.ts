import { type Context, type MiddlewareHandler, Hono } from "hono";
import type { AddGroupParams, LoadLibraryParams } from "./load/workflows";
import { LibraryId, type AccessLevel } from "../shared/types";
import { type OAuthApi } from "./onshape-api/onshape-api";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";

export interface AppBindings {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    THUMBNAILS: R2Bucket;
    LOAD_LIBRARY_WORKFLOW: Workflow<LoadLibraryParams>;
    ADD_GROUP_WORKFLOW: Workflow<AddGroupParams>;
    ADMIN_TEAM: string;
    ACCESS_LEVEL_OVERRIDE?: string;
}

interface AppVariables {
    /** Internal cache for {@link getOnshapeApi} in auth.ts. */
    onshapeApi?: OAuthApi;
    /** Injected getters — see {@link AppServices} / `createApp`. */
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    getAccessLevel: () => Promise<AccessLevel>;
}

export interface AppContextEnv {
    Bindings: AppBindings;
    Variables: AppVariables;
}

export type AppContext = Context<AppContextEnv>;

/**
 * Per-request dependencies injected into the app.
 */
export interface AppServices {
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    getAccessLevel: () => Promise<AccessLevel>;
}

export type AppServicesFactory = (c: AppContext) => AppServices;

export function getApp() {
    return new Hono<AppContextEnv>();
}

export function libraryRoute(): string {
    return "/library/:libraryId";
}

export function getLibraryParam(c: AppContext): LibraryId {
    const libraryId = c.req.param("libraryId");
    const parsed = z.enum(LibraryId).safeParse(libraryId);
    if (!parsed.success) {
        throw new HTTPException(400, { message: "Invalid libraryId" });
    }
    return parsed.data;
}

/** A year — a versioned url's content never changes, only its version does. */
const VERSIONED_CACHE_TTL = 365 * 24 * 3600;

/**
 * Validates the `?v=` cache version — a library's cache version or an element's
 * microversion, depending on the route.
 */
export const validateCacheVersion = zValidator(
    "query",
    z.object({ v: z.string().min(1) }),
    (result) => {
        if (!result.success) {
            throw new HTTPException(400, { message: "Missing cache version" });
        }
    }
);

type CacheVisibility = "public" | "private";

export function immutableCacheControl(visibility: CacheVisibility): string {
    return `${visibility}, max-age=${VERSIONED_CACHE_TTL}, immutable`;
}

/** Caches a `?v=`-keyed response forever. */
export function immutableCacheMiddleware(
    visibility: CacheVisibility = "public"
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        await next();
        // Only a response that succeeded — a miss must stay retryable.
        if (c.res.ok) {
            c.header("Cache-Control", immutableCacheControl(visibility));
        }
    };
}

/** Opts a response out of every cache. */
export const noStoreMiddleware: MiddlewareHandler<AppContextEnv> = async (
    c,
    next
) => {
    await next();
    c.header("Cache-Control", "private, no-store");
};

export function insertableRoute(): string {
    return "/insertable/:insertableId";
}

export function getInsertableParam(c: AppContext): string {
    const id = c.req.param("insertableId");
    if (!id) throw new Error("Missing insertableId route param");
    return id;
}

export function groupRoute(): string {
    return "/group/:groupId";
}

export function getGroupParam(c: AppContext): string {
    const id = c.req.param("groupId");
    if (!id) throw new Error("Missing groupId route param");
    return id;
}
