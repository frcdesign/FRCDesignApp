import { type Context } from "hono";

export type AppBindings = {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  THUMBNAILS: R2Bucket;
};

export type AppContext = Context<{ Bindings: AppBindings }>;
