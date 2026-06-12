import { type Context, Hono } from "hono";
import type { LoadDocumentParams } from "./parse/load-document";
import { type LibraryId } from "../shared/types";
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
    onshapeApi: OAuthApi;
}

export interface AppContextEnv {
    Bindings: AppBindings;
    Variables: AppVariables;
}

export type AppContext = Context<AppContextEnv>;

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
