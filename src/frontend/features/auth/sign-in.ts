import { updateUiState } from "../../lib/ui-state";

/**
 * Redirects to the Onshape OAuth flow, returning to the app's entry point,
 * which resumes where the caller left off and confirms the sign-in.
 */
export function startSignIn(): void {
    updateUiState({ justSignedIn: true });
    const search = new URLSearchParams(window.location.search);
    const query = new URLSearchParams({
        redirectUrl: "/" + window.location.search
    });
    // The entry redirect leaves Onshape's company in the app's url. It has to
    // ride as a parameter of its own: nested inside redirectUrl the sign-in
    // route never reads it, and the token comes back scoped to whichever
    // account Onshape picks rather than the enterprise the caller is in.
    const sessionCompanyId = search.get("sessionCompanyId");
    if (sessionCompanyId) {
        query.set("sessionCompanyId", sessionCompanyId);
    }
    window.location.href = "/auth/sign-in?" + query.toString();
}
