import { type Context } from "hono";
import type { LoadDocumentParams } from "./api/load-document";

export type AppBindings = {
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    THUMBNAILS: R2Bucket;
    LOAD_DOCUMENT_WORKFLOW: Workflow<LoadDocumentParams>;
};

export type AppContext = Context<{ Bindings: AppBindings }>;
