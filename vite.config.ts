import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { existsSync, readFileSync } from "fs";

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
