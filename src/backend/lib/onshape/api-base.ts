/**
 * Where Onshape's API lives. A leaf, because the client is not the only thing
 * that needs it: a url the browser fetches itself has to name the same host.
 */

// Constant across all environments (dev/cert/production), so hardcoded here
// rather than duplicated as a per-environment var in wrangler.jsonc.
const ONSHAPE_API_BASE_PATH = "https://cad.onshape.com";
const ONSHAPE_API_VERSION = 16;

export function getBaseUrl(): string {
    return `${ONSHAPE_API_BASE_PATH}/api/v${ONSHAPE_API_VERSION}`;
}

/** An absolute url for an api path, e.g. `/thumbnails/d/{did}/w/{wid}/s/70x40`. */
export function onshapeApiUrl(path: string): string {
    return getBaseUrl() + path;
}
