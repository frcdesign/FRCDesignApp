import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Only applies what's missing, so repeated setup is safe.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
