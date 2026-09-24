import { updateUiState } from "../../lib/ui-state";

/** Returns to the entry, which resumes and confirms the sign-in. */
export function startSignIn(): void {
    updateUiState({ justSignedIn: true });
    const search = new URLSearchParams(window.location.search);
    const query = new URLSearchParams({
        redirectUrl: "/" + window.location.search
    });
    // Its own parameter: nested in redirectUrl the sign-in route never reads it,
    // and the token comes back scoped to the wrong account.
    const sessionCompanyId = search.get("sessionCompanyId");
    if (sessionCompanyId) {
        query.set("sessionCompanyId", sessionCompanyId);
    }
    window.location.href = "/auth/sign-in?" + query.toString();
}
