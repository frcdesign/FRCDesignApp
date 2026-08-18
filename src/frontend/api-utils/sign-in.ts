import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccessDataQuery } from "./access-level";
import { showSuccessToast } from "../common/notifications";

const PENDING_SIGN_IN_KEY = "frc-design-app-pending-sign-in";

/** Redirects to the Onshape OAuth flow, returning to the current location. */
export function startSignIn(): void {
    // The round trip reloads the app, so leave a note to report the result on
    // the way back in.
    try {
        sessionStorage.setItem(PENDING_SIGN_IN_KEY, "true");
    } catch {
        // Ignore storage failures (e.g. private browsing).
    }
    const redirectUrl = window.location.pathname + window.location.search;
    window.location.href =
        "/auth/sign-in?redirectUrl=" + encodeURIComponent(redirectUrl);
}

/** Whether this load followed a sign-in attempt, clearing the flag either way. */
function consumePendingSignIn(): boolean {
    try {
        const pending = sessionStorage.getItem(PENDING_SIGN_IN_KEY) !== null;
        sessionStorage.removeItem(PENDING_SIGN_IN_KEY);
        return pending;
    } catch {
        return false;
    }
}

/** Confirms a sign-in once the caller lands back from Onshape. */
export function useSignInToast(): void {
    const accessData = useQuery(getAccessDataQuery()).data;
    useEffect(() => {
        // Wait for access data so a denied grant clears the flag rather than
        // toasting on some later visit in the same tab.
        if (!accessData || !consumePendingSignIn()) {
            return;
        }
        if (accessData.signedIn) {
            showSuccessToast("Signed in to Onshape.");
        }
    }, [accessData]);
}
