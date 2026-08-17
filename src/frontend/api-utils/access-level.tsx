import { PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { hasEditorAccess } from "../../shared/types";
import { hasAdminAccess } from "../../shared/types";
import { AccessLevel, type AccessData } from "../../shared/types";
import { getAccessDataQuery } from "../queries";

/** What an unresolved caller gets: the least the app can show anyone. */
const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: AccessLevel.USER,
    currentAccessLevel: AccessLevel.USER,
    signedIn: false
};

/** The caller's access, which nothing waits for — editor affordances appear late. */
export function useAccessData(): AccessData {
    return useQuery(getAccessDataQuery()).data ?? DEFAULT_ACCESS_DATA;
}

/** Whether the caller is signed in to Onshape (from access-data). */
export function useIsSignedIn(): boolean {
    return useAccessData().signedIn;
}

interface RequireAccessLevelProps extends PropsWithChildren {
    /**
     * @optional
     * @default AccessLevel.EDITOR
     */
    accessLevel?: AccessLevel;
    /**
     * If specified, this will check against the maxAccessLevel instead of currentAccessLevel.
     * @default false
     */
    useMaxAccessLevel?: boolean;
}

/**
 * Simple component which renders children only if the given accessLevel requirement is met.
 */
export function RequireAccessLevel(props: RequireAccessLevelProps) {
    const accessData = useAccessData();
    const requiredAccessLevel = props.accessLevel ?? AccessLevel.EDITOR;
    const currentAccessLevel = props.useMaxAccessLevel
        ? accessData.maxAccessLevel
        : accessData.currentAccessLevel;

    if (
        requiredAccessLevel === AccessLevel.ADMIN &&
        hasAdminAccess(currentAccessLevel)
    ) {
        return props.children;
    } else if (
        requiredAccessLevel === AccessLevel.EDITOR &&
        hasEditorAccess(currentAccessLevel)
    ) {
        return props.children;
    }
    return null;
}

/** Renders children only when the caller is signed in to Onshape. */
export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
