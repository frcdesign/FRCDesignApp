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
    /** Internal cache for `getOnshapeApi` in features/auth/request-auth.ts. */
    onshapeApi?: OAuthApi;
    /** Internal cache for `isSignedIn` in features/auth/request-auth.ts. */
    signedIn?: boolean;
    /** Injected by {@link bindAuth}; see {@link RequestAuth}. */
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
 * What a route may ask about the request it is serving: who is making it, and
 * what they are allowed to do. Resolved lazily, so a route that asks nothing
 * calls Onshape not at all, and answered per request, so a test can answer
 * without a session. `productionAuth` answers for real.
 */
export interface RequestAuth {
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    getAccessLevel: () => Promise<AccessLevel>;
    isAuthenticated: () => Promise<boolean>;
}

/** How one request's answers are resolved; the app is built with one. */
export type AuthResolver = (c: AppContext) => RequestAuth;

/** Puts the request's own answers behind `c.var`, for routes to ask. */
export function bindAuth(
    resolveAuth: AuthResolver
): MiddlewareHandler<AppContextEnv> {
    return async (c, next) => {
        const auth = resolveAuth(c);
        c.set("getOnshapeApi", auth.getOnshapeApi);
        c.set("getUserId", auth.getUserId);
        c.set("getAccessLevel", auth.getAccessLevel);
        c.set("isAuthenticated", auth.isAuthenticated);
        await next();
    };
}

export function getApp() {
    return new Hono<AppContextEnv>();
}
