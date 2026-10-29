/** Reloads in place, so access data is refetched signed out. */
export function startSignOut(): void {
    const url = new URL(window.location.href);
    const redirectUrl = url.pathname + url.search;
    window.location.href =
        "/auth/sign-out?redirectUrl=" + encodeURIComponent(redirectUrl);
}
