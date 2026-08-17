/** Redirects to the Onshape OAuth flow, returning to the current location. */
export function startSignIn(): void {
    const redirectUrl = window.location.pathname + window.location.search;
    window.location.href =
        "/auth/sign-in?redirectUrl=" + encodeURIComponent(redirectUrl);
}
