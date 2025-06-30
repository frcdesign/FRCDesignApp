import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        origin: "http://localhost:5173",
        port: 5173,
        strictPort: true
    },
    build: {
        outDir: "../backend/dist",
        emptyOutDir: true
    }
});
