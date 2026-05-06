import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true
        }),
        react()
    ],
    server: {
        origin: "http://localhost:5173",
        port: 5173,
        strictPort: true
    },
    build: {
        outDir: "../backend/dist",
        emptyOutDir: true
        // Target esnext so, e.g., top level await is available
        // target: "esnext"
    }
});
