import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { resetStorage } from "./storage";

// Test files share a worker's storage (`isolate: false` in vitest.config.ts),
// so each starts from what a freshly migrated D1 holds.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
await resetStorage();
