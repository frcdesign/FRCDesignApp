import {
    cloudflareTest,
    readD1Migrations
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            {
                // Pure logic (frontend) tests run in a fast Node environment.
                test: {
                    name: "node",
                    environment: "node",
                    include: ["src/frontend/**/*.test.ts"]
                }
            },
            {
                // Backend tests run in the Workers runtime with real, per-test
                // isolated D1/R2/KV bindings from wrangler.jsonc.
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
                    setupFiles: ["./src/__test_utils__/apply-migrations.ts"],
                    maxWorkers: 1
                }
            }
        ]
    }
});
