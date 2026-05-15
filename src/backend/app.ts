import { Hono } from "hono";

type Bindings = {
  db: D1Database;
  kv: KVNamespace;
};

export const app = new Hono<{ Bindings: Bindings }>();
