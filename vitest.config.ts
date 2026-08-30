import {
    cloudflareTest,
    readD1Migrations
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { alias } from "./vite.config";

// `.env` is for driving the app locally (see AGENTS.md); letting it reach the
// test Worker would make FORCE_SIGNED_IN rewrite what the auth tests assert.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";

export default defineConfig({
    test: {
        projects: [
            {
                resolve: { alias },
                // Frontend logic needs no bindings, so it runs in a fast Node environment.
                test: {
                    name: "node",
                    environment: "node",
                    include: ["src/frontend/**/*.test.ts"]
                }
            },
            {
                // Backend tests run in the Workers runtime with real, per-test
                // isolated D1/R2/KV bindings from wrangler.jsonc.
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
                    include: ["src/backend/**/*.test.ts"],
                    setupFiles: ["./src/__test_utils__/apply-migrations.ts"]
                }
            }
        ]
    }
});
