import { getUiState, updateUiState } from "../../lib/ui-state";

/** Returns to the page it was started from. */
export function startSignIn(): void {
    updateUiState({ justSignedIn: true });
    const query = new URLSearchParams({
        redirectUrl: window.location.pathname + window.location.search
    });
    const { sessionCompanyId } = getUiState();
    if (sessionCompanyId) {
        query.set("sessionCompanyId", sessionCompanyId);
    }
    window.location.href = "/auth/sign-in?" + query.toString();
}
