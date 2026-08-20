import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

// Only enable https when localhost exists
const httpsKeyPath = "localhost-key.pem";
const httpsCertPath = "localhost.pem";
const httpsDevServer =
    existsSync(httpsKeyPath) && existsSync(httpsCertPath)
        ? {
              key: readFileSync(httpsKeyPath),
              cert: readFileSync(httpsCertPath)
          }
        : undefined;

const srcPath = (dir: string) =>
    fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

/** Only the frontend -> backend contract imports use these; see AGENTS.md. */
export const alias = {
    "@backend": srcPath("backend"),
    "@frontend": srcPath("frontend")
};

// https://vite.dev/config/
export default defineConfig({
    resolve: { alias },
    plugins: [
        tanstackRouter({
            routesDirectory: "src/frontend/routes",
            generatedRouteTree: "src/frontend/routeTree.gen.ts"
        }),
        react(),
        cloudflare()
    ],
    server: {
        https: httpsDevServer,
        port: 3000,
        strictPort: true
    }
});
