import { type Context, Hono } from "hono";
import type {
    AddGroupParams,
    LoadLibraryParams,
    ThumbnailWorkflowParams
} from "../features/library/workflows/index";
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
    ACCESS_LEVEL_OVERRIDE?: string;
    /** Testing-only: treat requests as signed in with a fake user. Not for production. */
    FORCE_SIGNED_IN?: string;
}

interface AppVariables {
    /** Internal cache for {@link getOnshapeApi} in features/auth/onshape-oauth.ts. */
    onshapeApi?: OAuthApi;
    /** Internal cache for isSignedIn in features/auth/sign-in.ts. */
    signedIn?: boolean;
    /** Set by `setCacheTtl`; read by `cacheMiddleware`. */
    cacheTtl?: number;
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
