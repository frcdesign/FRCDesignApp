import type { D1Migration } from "cloudflare:test";

// Test-only binding injected by vitest.config.ts so it can be applied in the
// `apply-migrations.ts` setup file.
declare global {
    namespace Cloudflare {
        interface Env {
            TEST_MIGRATIONS: D1Migration[];
        }
    }
}

export {};
