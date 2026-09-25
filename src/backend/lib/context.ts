import { type Context, type MiddlewareHandler, Hono } from "hono";
import type { LoadDocumentParams } from "../features/load/jobs";
import type { RenderThumbnailParams } from "../features/thumbnails/render-workflow";
import type { PushHub } from "../features/push/push-hub";
import { type AccessLevel } from "../features/auth/access-level";
import type { LibraryId } from "../features/library/library-id";
import { type OAuthApi } from "./onshape/client";

export interface AppBindings {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    /** Thumbnails and search indexes; prefixes keep them apart. */
    BLOB: R2Bucket;
    /** One instance per group being loaded at a time; see `load/jobs.ts`. */
    LOAD_DOCUMENT_WORKFLOW: Workflow<LoadDocumentParams>;
    /** One instance per configuration being rendered; see `requestRender`. */
    RENDER_THUMBNAIL_WORKFLOW: Workflow<RenderThumbnailParams>;
    /** Relays pushes to open clients; see `features/push`. */
    PUSH_HUB: DurableObjectNamespace<PushHub>;
    /** The Onshape user id granted `AccessLevel.OWNER`; unset grants nobody. */
    OWNER_USER_ID?: string;
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
    getAccessLevel: (libraryId: LibraryId) => Promise<AccessLevel>;
    isAuthenticated: () => Promise<boolean>;
}

export interface AppContextEnv {
    Bindings: AppBindings;
    Variables: AppVariables;
}

export type AppContext = Context<AppContextEnv>;

/** Lazy, so a route that asks nothing never calls Onshape; per request, so tests can stub it. */
interface RequestAuth {
    getOnshapeApi: () => Promise<OAuthApi>;
    getUserId: () => Promise<string>;
    /** The caller's access to one library; the owner's is the same in all. */
    getAccessLevel: (libraryId: LibraryId) => Promise<AccessLevel>;
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
