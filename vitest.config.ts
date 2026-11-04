import {
    cloudflareTest,
    readD1Migrations
} from "@cloudflare/vitest-pool-workers";
import { type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { alias } from "./vite.config";

// `.env` is for driving the app locally (see AGENTS.md); letting it reach the
// test Worker would make FORCE_SIGNED_IN rewrite what the auth tests assert.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";

/**
 * Only tests that need bindings pay for a Workers runtime and a migrated D1,
 * which cost far more than the tests themselves; they say so by their name.
 * Everything else runs in Node.
 */
const WORKER_TESTS = "src/backend/**/*.worker.test.ts";

const PHOSPHOR_IMPORT =
    /import\s*\{([^}]*)\}\s*from\s*"@phosphor-icons\/react";?/g;

/**
 * Imports each icon from its own module. The package's index loads all of its
 * icons, which costs over a second in every test file that renders one. Line
 * count is kept, so stack traces still point at the right line.
 */
function phosphorIconPerModule(): Plugin {
    return {
        name: "phosphor-icon-per-module",
        enforce: "pre",
        transform(code, id) {
            if (!/\.tsx?$/.test(id) || id.includes("/node_modules/")) return;
            return code.replace(PHOSPHOR_IMPORT, (whole, names: string) => {
                const imports = names
                    .split(",")
                    .map((name) => name.trim())
                    .filter((name) => name && !name.startsWith("type "))
                    .map((name) => {
                        const icon = /^(\w+)Icon\b/.exec(name)?.[1];
                        const from = icon
                            ? `@phosphor-icons/react/dist/csr/${icon}`
                            : "@phosphor-icons/react";
                        return `import { ${name} } from "${from}";`;
                    });
                return (
                    imports.join(" ") +
                    "\n".repeat(whole.split("\n").length - 1)
                );
            });
        }
    };
}

export default defineConfig({
    test: {
        projects: [
            {
                resolve: { alias },
                plugins: [phosphorIconPerModule()],
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
                plugins: [phosphorIconPerModule()],
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
                    // One runtime per worker rather than per file, which costs seconds
                    // a file; the setup file gives each file empty storage instead.
                    isolate: false,
                    setupFiles: ["./src/__test_utils__/apply-migrations.ts"]
                }
            }
        ]
    }
});
