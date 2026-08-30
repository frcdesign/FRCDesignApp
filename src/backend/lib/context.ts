import { type Context, type MiddlewareHandler, Hono } from "hono";
import type {
    AddGroupParams,
    LoadLibraryParams
} from "../features/load/workflows";
import type { ThumbnailWorkflowParams } from "../features/thumbnails/workflow";
import { type AccessLevel } from "../features/auth/access-level";
import { type OAuthApi } from "./onshape/client";

export interface AppBindings {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    /** Thumbnails and search indexes; prefixes keep them apart. */
    BLOB: R2Bucket;
    LOAD_LIBRARY_WORKFLOW: Workflow<LoadLibraryParams>;
    ADD_GROUP_WORKFLOW: Workflow<AddGroupParams>;
    /** Renders a configuration's thumbnails outside a request; see ThumbnailWorkflow. */
    THUMBNAIL_WORKFLOW: Workflow<ThumbnailWorkflowParams>;
    ADMIN_TEAM: string;
    /** Dev-only: the access level granted, bypassing Onshape. */
    VITE_ACCESS_LEVEL_OVERRIDE?: string;
    /** Testing-only: treat requests as signed in with a fake user. Not for production. */
    FORCE_SIGNED_IN?: string;
}

interface AppVariables {
    /** Internal cache for `getOnshapeApi` in features/auth/caller.ts. */
    onshapeApi?: OAuthApi;
    /** Internal cache for `isSignedIn` in features/auth/caller.ts. */
    signedIn?: boolean;
    /** Set by `setCacheTtl`; read by `cacheMiddleware`. */
    cacheTtl?: number;
    /** Injected by {@link bindCaller}; see {@link Caller}. */
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
 * Who is making the request, injected per request so tests can substitute a
 * caller without an Onshape session. `productionCaller` is the real one.
 */
export interface Caller {
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    getAccessLevel: () => Promise<AccessLevel>;
    isAuthenticated: () => Promise<boolean>;
}

export type CallerFactory = (c: AppContext) => Caller;

/** Binds the caller's lookups onto each request, behind `c.var`. */
export function bindCaller(
    makeCaller: CallerFactory
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        const caller = makeCaller(c);
        c.set("getOnshapeApi", caller.getOnshapeApi);
        c.set("getUserId", caller.getUserId);
        c.set("getAccessLevel", caller.getAccessLevel);
        c.set("isAuthenticated", caller.isAuthenticated);
        await next();
    };
}

export function getApp() {
    return new Hono<AppContextEnv>();
}
