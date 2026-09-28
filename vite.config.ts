import { defineConfig, loadEnv } from "vite";
import { unstable_readConfig } from "wrangler";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "url";

const srcPath = (dir: string) =>
    fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

/** Only the frontend -> backend contract imports use these; see AGENTS.md. */
export const alias = {
    "@backend": srcPath("backend"),
    "@frontend": srcPath("frontend")
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    resolve: { alias },
    plugins: [
        tanstackRouter({
            routesDirectory: "src/frontend/routes",
            generatedRouteTree: "src/frontend/routeTree.gen.ts",
            // Splits each route's component into its own chunk, which is what
            // keeps the dashboard's charts out of the Onshape panel's bundle.
            autoCodeSplitting: true
        }),
        react(),
        cloudflare()
    ],
    server: {
        port: 3000,
        strictPort: true,
        // The dev tunnel's host, which Vite otherwise turns away.
        allowedHosts: [new URL(devAppUrl(mode)).hostname]
    }
}));

/** `.env` overrides the dev var, as it does for the Worker. */
function devAppUrl(mode: string): string {
    const appUrl =
        loadEnv(mode, process.cwd(), "").APP_URL ??
        unstable_readConfig({ config: "wrangler.jsonc" }).vars.APP_URL;
    if (typeof appUrl !== "string") {
        throw new Error("Set APP_URL in wrangler.jsonc's vars");
    }
    return appUrl;
}
