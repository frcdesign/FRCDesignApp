import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { showSuccessToast } from "../common/notifications";

const SIGNED_IN_PARAM = "justSignedIn";

/**
 * Redirects to the Onshape OAuth flow, returning to the current location with a
 * marker so the app can confirm the sign-in once it lands back.
 */
export function startSignIn(): void {
    const url = new URL(window.location.href);
    url.searchParams.set(SIGNED_IN_PARAM, "true");
    const redirectUrl = url.pathname + url.search;
    window.location.href =
        "/auth/sign-in?redirectUrl=" + encodeURIComponent(redirectUrl);
}

/** Confirms a sign-in once the caller lands back from Onshape, then clears the marker. */
export function useSignInToast(): void {
    const justSignedIn = useSearch({ from: "/app" }).justSignedIn;
    const navigate = useNavigate({ from: "/app" });
    useEffect(() => {
        // The OAuth callback only redirects here on success, so the marker's
        // presence is the confirmation.
        if (!justSignedIn) {
            return;
        }
        showSuccessToast("Signed in to Onshape.");
        void navigate({
            search: (prev) => ({ ...prev, [SIGNED_IN_PARAM]: undefined }),
            replace: true
        });
    }, [justSignedIn, navigate]);
}
