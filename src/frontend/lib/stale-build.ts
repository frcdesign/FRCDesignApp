const RELOADED_AT_KEY = "stale-build-reloaded-at";
/** A chunk still missing this soon after a reload isn't a stale tab, so the crash page shows. */
const RELOAD_GUARD_MS = 10_000;

/** Whether this tab may reload now, recording that it does; a tab without storage never does. */
function takeReload(now: number): boolean {
    try {
        const last = Number(sessionStorage.getItem(RELOADED_AT_KEY));
        if (now - last < RELOAD_GUARD_MS) {
            return false;
        }
        sessionStorage.setItem(RELOADED_AT_KEY, String(now));
        return true;
    } catch {
        return false;
    }
}

/**
 * A deploy removes the last build's chunks, so a tab opened before it fails
 * its next lazy import. Vite reports that as `vite:preloadError`; reloading
 * fetches the new build.
 */
export function reloadOnStaleBuild(
    reload = () => window.location.reload()
): () => void {
    const onPreloadError = (event: Event) => {
        if (takeReload(Date.now())) {
            event.preventDefault();
            reload();
        }
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () =>
        window.removeEventListener("vite:preloadError", onPreloadError);
}
