/**
 * Where Onshape's API lives. A leaf, because the client is not the only thing
 * that needs it: a url the browser fetches itself has to name the same api on
 * the caller's own Onshape origin.
 */

const ONSHAPE_API_VERSION = 16;

// Constant across all environments (dev/cert/production), so hardcoded here
// rather than duplicated as a per-environment var in wrangler.jsonc. A company
// session's own origin serves the same api; see `toOnshapeOrigin`.
const ONSHAPE_ORIGIN = "https://cad.onshape.com";

/** What every api path hangs off, e.g. `/api/v16`. */
export const ONSHAPE_API_PREFIX = `/api/v${ONSHAPE_API_VERSION}`;

/** What the worker calls: cad's api, whichever company the caller is in. */
export function getBaseUrl(): string {
    return ONSHAPE_ORIGIN + ONSHAPE_API_PREFIX;
}

/** An api url on a given Onshape origin, e.g. a company's own. */
export function onshapeApiUrl(origin: string, path: string): string {
    return origin + ONSHAPE_API_PREFIX + path;
}
