import { PropsWithChildren } from "react";
import { useAccessData } from "./access-level";

/** Whether the caller is signed in to Onshape (from access-data). */
export function useIsSignedIn(): boolean {
    return useAccessData().signedIn;
}

/**
 * Renders children only when the user is signed in to Onshape. The mirror of
 * {@link RequireAccessLevel} for sign-in-gated UI (insert, favorites, ...).
 */
export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
