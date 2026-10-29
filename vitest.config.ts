import {
    cloudflareTest,
    readD1Migrations
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { alias } from "./vite.config";

// `.env` is for driving the app locally (see AGENTS.md); letting it reach the
// test Worker would make FORCE_SIGNED_IN rewrite what the auth tests assert.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";

/**
 * Only tests that need bindings pay for a Workers runtime and a migrated D1
 * per file, which costs far more than the tests themselves; they say so by
 * their name. Everything else runs in Node.
 */
const WORKER_TESTS = "src/backend/**/*.worker.test.ts";

export default defineConfig({
    test: {
        projects: [
            {
                resolve: { alias },
                test: {
                    name: "node",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                    exclude: [WORKER_TESTS]
                }
            },
            {
                // Components, rendered into a DOM the way the app renders them.
                resolve: { alias },
                test: {
                    name: "dom",
                    environment: "jsdom",
                    include: ["src/frontend/**/*.test.tsx"],
                    setupFiles: ["./src/__test_utils__/dom-setup.ts"]
                }
            },
            {
                // Real, per-test isolated D1/R2/KV bindings from wrangler.jsonc.
                resolve: { alias },
                plugins: [
                    cloudflareTest(async () => {
                        const migrations = await readD1Migrations("./drizzle");
                        return {
                            wrangler: { configPath: "./wrangler.jsonc" },
                            miniflare: {
                                // Test-only binding consumed by apply-migrations.ts.
                                bindings: { TEST_MIGRATIONS: migrations }
                            }
                        };
                    })
                ],
                test: {
                    name: "backend",
                    include: [WORKER_TESTS],
                    setupFiles: ["./src/__test_utils__/apply-migrations.ts"]
                }
            }
        ]
    }
});
