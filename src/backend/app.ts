import { type Context } from "hono";
import type { LoadDocumentParams } from "./parse/load-document";
import { type Library } from "../shared/types";

export type AppBindings = {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    THUMBNAILS: R2Bucket;
    LOAD_DOCUMENT_WORKFLOW: Workflow<LoadDocumentParams>;
    ADMIN_TEAM: string;
    ACCESS_LEVEL_OVERRIDE?: string;
};

export type AppContext = Context<{ Bindings: AppBindings }>;

export function libraryRoute(): string {
    return "/library/:library";
}

export function getLibraryParam(c: AppContext): Library {
    return c.req.param("library") as Library;
}
