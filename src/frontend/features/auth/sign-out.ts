/**
 * Ends the app's own session and reloads where the caller stands, which is what
 * makes the next load fetch access data as a signed-out one.
 */
export function startSignOut(): void {
    const url = new URL(window.location.href);
    const redirectUrl = url.pathname + url.search;
    window.location.href =
        "/auth/sign-out?redirectUrl=" + encodeURIComponent(redirectUrl);
}
