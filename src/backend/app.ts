import { type Context, Hono } from "hono";
import type { LoadDocumentParams } from "./parse/load-document";
import { type AccessLevel, type LibraryId } from "../shared/types";
import { type OAuthApi } from "./onshape-api/onshape-api";

export interface AppBindings {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    THUMBNAILS: R2Bucket;
    LOAD_DOCUMENT_WORKFLOW: Workflow<LoadDocumentParams>;
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
 * The per-request dependencies injected into the app. Production wiring lives in
 * `services.ts`; tests provide mocks via `createTestApp`. `createApp` binds these
 * onto the context so handlers can call `c.var.getUserId()` etc. directly.
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
    return c.req.param("libraryId") as LibraryId;
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
