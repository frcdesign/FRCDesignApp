import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
// import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";

// https://vitejs.dev/config/
export default defineConfig(() => {
    return {
        plugins: [tanstackStart(), viteReact()],
        server: {
            https: {
                key: fs.readFileSync("localhost-key.pem"),
                cert: fs.readFileSync("localhost.pem")
            },
            port: 3000,
            strictPort: true
        },
        resolve: {
            tsconfigPaths: true
        }
        // build: {
        //     outDir: "../backend/dist",
        //     emptyOutDir: true
        // }
    };
});
