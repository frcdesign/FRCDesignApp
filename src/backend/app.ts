import { type Context, Hono } from "hono";
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
        throw new HTTPException(HttpStatus.BAD_REQUEST, {
            message: "Invalid libraryId"
        });
    }
    return parsed.data;
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
