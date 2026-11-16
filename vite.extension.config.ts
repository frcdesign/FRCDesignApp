import { defineConfig } from "vite";
import { alias } from "./vite.config";
import {
    CompanionBrowser,
    companionManifest,
    companionTarget
} from "./src/extension/manifest";

/**
 * The Companion for one browser, named by `--mode`: one classic script, since
 * a content script can't be a module, beside its manifest.
 */
export default defineConfig(({ mode }) => {
    const browser = Object.values(CompanionBrowser).find(
        (candidate) => candidate === mode
    );
    if (!browser) {
        throw new Error(
            `Build the Companion with --mode ${Object.values(CompanionBrowser).join(" or --mode ")}.`
        );
    }
    return {
        publicDir: false,
        resolve: { alias },
        build: {
            outDir: `dist-extension/${browser}`,
            emptyOutDir: true,
            target: companionTarget(browser),
            lib: {
                entry: "src/extension/main.ts",
                formats: ["iife"],
                name: "frcDesignAppCompanion",
                fileName: () => "main.js"
            }
        },
        plugins: [
            {
                name: "companion-manifest",
                generateBundle() {
                    this.emitFile({
                        type: "asset",
                        fileName: "manifest.json",
                        source: JSON.stringify(
                            companionManifest(browser),
                            null,
                            4
                        )
                    });
                }
            }
        ]
    };
});
