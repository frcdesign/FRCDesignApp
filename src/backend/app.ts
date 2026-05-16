import { Hono, type Context } from "hono";

export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  THUMBNAILS: R2Bucket;
};

export type AppContext = Context<{ Bindings: Bindings }>;

export const app = new Hono<{ Bindings: Bindings }>();
