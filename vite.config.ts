import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { readFileSync } from "fs";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({
            routesDirectory: "src/frontend/routes",
            generatedRouteTree: "src/frontend/routeTree.gen.ts"
        }),
        react(),
        cloudflare()
    ],
    server: {
        https: {
            key: readFileSync("localhost-key.pem"),
            cert: readFileSync("localhost.pem")
        },
        port: 3000,
        strictPort: true
    }
});
