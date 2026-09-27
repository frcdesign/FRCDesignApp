import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "url";

const DEFAULT_DEV_HOSTNAME = "dev.frcdesign.org";

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
        // The dev tunnel's hostname, which Vite otherwise turns away.
        allowedHosts: [
            loadEnv(mode, process.cwd(), "").DEV_HOSTNAME ||
                DEFAULT_DEV_HOSTNAME
        ]
    }
}));
