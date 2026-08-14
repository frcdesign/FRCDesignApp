import { type Context, Hono } from "hono";
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

/** Rejects unknown libraries before a handler runs. */
export const validateLibraryParam = zValidator(
    "param",
    z.object({ libraryId: z.enum(LibraryId) }),
    (result) => {
        if (!result.success) {
            throw new HTTPException(400, { message: "Invalid libraryId" });
        }
    }
);

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
 * microversion, depending on the route. No handler reads it, but a request
 * without one pins itself to whatever the immutable caches below already hold,
 * so warn rather than fail.
 */
export const validateCacheVersion = zValidator(
    "query",
    z.object({ v: z.string().optional() }),
    (result, c) => {
        const version = result.success ? result.data.v : undefined;
        if (!version) {
            console.warn(`Missing cache version on ${c.req.path}`);
        }
    }
);

/**
 * Caches a `?v=`-keyed response forever. Editor-only data must stay `private`
 * so a shared cache can't hand it to a user who isn't one.
 */
export function setVersionedCacheHeaders(
    c: AppContext,
    visibility: "public" | "private" = "public"
): void {
    c.header(
        "Cache-Control",
        `${visibility}, max-age=${VERSIONED_CACHE_TTL}, immutable`
    );
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
