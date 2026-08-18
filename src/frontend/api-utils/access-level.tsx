import { PropsWithChildren, useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { hasEditorAccess } from "../../shared/types";
import { hasAdminAccess } from "../../shared/types";
import { isWithinAccessLevel } from "../../shared/types";
import { AccessLevel, type AccessData } from "../../shared/types";
import { apiGet } from "./api";
import { useUiState } from "./ui-state";

/** What an unresolved caller gets: the least the app can show anyone. */
const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: AccessLevel.USER,
    currentAccessLevel: AccessLevel.USER,
    signedIn: false
};

export function accessDataQueryKey() {
    return ["access-data"];
}

/** The caller's access level, which gates editor-only affordances. */
export function getAccessDataQuery() {
    return queryOptions<AccessData>({
        queryKey: accessDataQueryKey(),
        queryFn: () => apiGet("/access-data")
    });
}

/**
 * The caller's access, which nothing waits for — editor affordances appear late.
 * The settings menu can view the app as a lower level (or a higher one, up to
 * the granted max); that choice is local state, so refetching the query — which
 * every navigation does — can't revert it.
 */
export function useAccessData(): AccessData {
    const serverData = useQuery(getAccessDataQuery()).data;
    const chosenLevel = useUiState()[0].accessLevel;
    return useMemo(() => {
        const accessData = serverData ?? DEFAULT_ACCESS_DATA;
        // A stored choice can outlive the access that allowed it.
        if (
            !chosenLevel ||
            !isWithinAccessLevel(chosenLevel, accessData.maxAccessLevel)
        ) {
            return accessData;
        }
        return { ...accessData, currentAccessLevel: chosenLevel };
    }, [serverData, chosenLevel]);
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
