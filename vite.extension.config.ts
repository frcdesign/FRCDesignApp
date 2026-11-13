import { defineConfig } from "vite";

/** The browser extension: one classic script, since a content script can't be a module. */
export default defineConfig({
    publicDir: "src/extension/public",
    build: {
        outDir: "dist-extension",
        emptyOutDir: true,
        target: "chrome111",
        lib: {
            entry: "src/extension/main.ts",
            formats: ["iife"],
            name: "frcDesignPreviewExtension",
            fileName: () => "main.js"
        }
    }
});
