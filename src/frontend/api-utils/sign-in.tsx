import { PropsWithChildren } from "react";
import { useLoaderData } from "@tanstack/react-router";

/** Whether the caller is signed in to Onshape (from context-data). */
export function useIsSignedIn(): boolean {
    return useLoaderData({ from: "/app" }).signedIn;
}

/**
 * Renders children only when the user is signed in to Onshape. The mirror of
 * {@link RequireAccessLevel} for sign-in-gated UI (insert, favorites, ...).
 */
export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
