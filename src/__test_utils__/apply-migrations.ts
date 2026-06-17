import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files run outside per-test-file storage isolation and may run multiple
// times. `applyD1Migrations()` only applies migrations that haven't been applied
// yet, so it is safe to call here. `TEST_MIGRATIONS` is supplied as a test-only
// binding from vitest.config.ts.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
