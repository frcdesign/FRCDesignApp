import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        origin: "http://localhost:5173",
        port: 5173,
        strictPort: true
    },
    build: {
        outDir: "../backend/dist",
        emptyOutDir: true,
        // Target esnext so, e.g., top level await is available
        target: "esnext"
    }
});
