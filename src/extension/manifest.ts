/** The Companion's manifest for each browser it's built for; `vite.extension.config.ts` writes it. */

export enum CompanionBrowser {
    CHROME = "chrome",
    FIREFOX = "firefox"
}

const VERSION = "0.1.0";

/** The first versions to run a content script in the page's own world. */
const MIN_CHROME = "111";
const MIN_FIREFOX = "128.0";

export function companionManifest(browser: CompanionBrowser): object {
    const common = {
        manifest_version: 3,
        name: "FRCDesignApp Companion",
        description:
            "Gives FRCDesignApp additional functionality inside Onshape, such as previews of parts before they're inserted.",
        version: VERSION,
        content_scripts: [
            {
                matches: ["https://*.onshape.com/*"],
                js: ["main.js"],
                run_at: "document_start",
                world: "MAIN"
            }
        ]
    };
    switch (browser) {
        case CompanionBrowser.CHROME:
            return { ...common, minimum_chrome_version: MIN_CHROME };
        case CompanionBrowser.FIREFOX:
            return {
                ...common,
                browser_specific_settings: {
                    gecko: {
                        // An MV3 add-on names its own id; it can't change once listed
                        id: "companion@frcdesign.org",
                        strict_min_version: MIN_FIREFOX,
                        data_collection_permissions: { required: ["none"] }
                    }
                }
            };
    }
}

/** What the script is compiled for: the oldest browser the manifest admits. */
export function companionTarget(browser: CompanionBrowser): string {
    switch (browser) {
        case CompanionBrowser.CHROME:
            return `chrome${MIN_CHROME}`;
        case CompanionBrowser.FIREFOX:
            return `firefox${MIN_FIREFOX.split(".")[0]}`;
    }
}
