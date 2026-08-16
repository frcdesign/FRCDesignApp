import { type Context, type MiddlewareHandler, Hono } from "hono";
import type { AddGroupParams, LoadLibraryParams } from "./load/workflows";
import { LibraryId, type AccessLevel } from "../shared/types";
import { type OAuthApi } from "./onshape-api/onshape-api";
import z from "zod";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";

export interface AppBindings {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    THUMBNAILS: R2Bucket;
    LOAD_LIBRARY_WORKFLOW: Workflow<LoadLibraryParams>;
    ADD_GROUP_WORKFLOW: Workflow<AddGroupParams>;
    ADMIN_TEAM: string;
    ACCESS_LEVEL_OVERRIDE?: string;
    /** Testing-only: treat requests as signed in with a fake user. Not for production. */
    FORCE_SIGNED_IN?: string;
}

interface AppVariables {
    /** Internal cache for {@link getOnshapeApi} in auth.ts. */
    onshapeApi?: OAuthApi;
    /** Internal cache for isSignedIn in sign-in-utils.ts. */
    signedIn?: boolean;
    /** Injected getters — see {@link AppServices} / `createApp`. */
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    getAccessLevel: () => Promise<AccessLevel>;
    isAuthenticated: () => Promise<boolean>;
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
    isAuthenticated: () => Promise<boolean>;
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
        throw new HTTPException(HttpStatus.BAD_REQUEST, {
            message: "Invalid libraryId"
        });
    }
    return parsed.data;
}

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
        c.header("Cache-Control", c.res.ok ? cacheControl : NO_STORE);
    };
}

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
