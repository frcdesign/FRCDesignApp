import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { existsSync, readFileSync } from "fs";

// Local HTTPS dev certs (mkcert) are only present on developer machines; they are
// absent in CI (e.g. the deploy workflow's build step), so only enable HTTPS when the
// cert files exist. `vite build` does not use the dev server and works without them.
const httpsKeyPath = "localhost-key.pem";
const httpsCertPath = "localhost.pem";
const httpsDevServer =
    existsSync(httpsKeyPath) && existsSync(httpsCertPath)
        ? {
              key: readFileSync(httpsKeyPath),
              cert: readFileSync(httpsCertPath)
          }
        : undefined;

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
        https: httpsDevServer,
        port: 3000,
        strictPort: true
    }
});
