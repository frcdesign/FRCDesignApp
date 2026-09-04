import { updateUiState } from "../../lib/ui-state";

/**
 * Redirects to the Onshape OAuth flow, returning to the app's entry point,
 * which resumes where the caller left off and confirms the sign-in.
 */
export function startSignIn(): void {
    updateUiState({ justSignedIn: true });
    const redirectUrl = "/" + window.location.search;
    window.location.href =
        "/auth/sign-in?redirectUrl=" + encodeURIComponent(redirectUrl);
}
