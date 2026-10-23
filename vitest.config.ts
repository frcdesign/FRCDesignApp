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
 * Only tests that need bindings run in the Workers runtime; they say so by
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
                    // Reloading every module for each file costs more than the tests
                    isolate: false,
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
                    isolate: false,
                    include: ["src/frontend/**/*.test.tsx"],
                    setupFiles: ["./src/__test_utils__/dom-setup.ts"]
                }
            },
            {
                // Real D1/R2/KV bindings from wrangler.jsonc. Isolating each file
                // reloads the Worker's modules, about 5 s a file, so files share
                // them, and reset-storage.ts empties storage before each.
                resolve: { alias },
                plugins: [
                    cloudflareTest(async () => {
                        const migrations = await readD1Migrations("./drizzle");
                        return {
                            wrangler: { configPath: "./wrangler.jsonc" },
                            miniflare: {
                                // Test-only binding consumed by reset-storage.ts.
                                bindings: { TEST_MIGRATIONS: migrations }
                            }
                        };
                    })
                ],
                test: {
                    name: "backend",
                    include: [WORKER_TESTS],
                    isolate: false,
                    setupFiles: ["./src/__test_utils__/reset-storage.ts"]
                }
            }
        ]
    }
});
