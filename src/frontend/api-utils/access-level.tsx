import { PropsWithChildren, useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
    AccessLevel,
    type AccessData,
    hasAdminAccess,
    hasEditorAccess,
    isWithinAccessLevel
} from "../../shared/access-level";
import { accessDataQueryKey } from "../query-keys";
import { apiGet } from "./api";
import { useUiState } from "./ui-state";

const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: AccessLevel.USER,
    signedIn: false
};

/** The level the app is viewed as by default; overridable in dev via a Vite var. */
const DEFAULT_ACCESS_LEVEL =
    (import.meta.env.VITE_DEFAULT_ACCESS_LEVEL as AccessLevel | undefined) ??
    AccessLevel.USER;

export function getAccessDataQuery() {
    return queryOptions<AccessData>({
        queryKey: accessDataQueryKey(),
        queryFn: () => apiGet("/access-data")
    });
}

/** Server access plus the level the app is currently viewed as. */
export interface ResolvedAccessData extends AccessData {
    currentAccessLevel: AccessLevel;
}

/**
 * The caller's access. The viewed level is a local choice (the settings menu can
 * drop below the granted max), so it survives the query refetching on navigation.
 */
export function useAccessData(): ResolvedAccessData {
    const serverData =
        useQuery(getAccessDataQuery()).data ?? DEFAULT_ACCESS_DATA;
    const chosenLevel = useUiState()[0].accessLevel;
    return useMemo(() => {
        const desired = chosenLevel ?? DEFAULT_ACCESS_LEVEL;
        // A stored choice can outlive the access that allowed it; clamp to max.
        const currentAccessLevel = isWithinAccessLevel(
            desired,
            serverData.maxAccessLevel
        )
            ? desired
            : serverData.maxAccessLevel;
        return { ...serverData, currentAccessLevel };
    }, [serverData, chosenLevel]);
}

/** Whether the caller is signed in to Onshape (from access-data). */
export function useIsSignedIn(): boolean {
    return useAccessData().signedIn;
}

interface RequireAccessLevelProps extends PropsWithChildren {
    /** @default AccessLevel.EDITOR */
    accessLevel?: AccessLevel;
    /** Check against maxAccessLevel instead of the viewed level. @default false */
    useMaxAccessLevel?: boolean;
}

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

export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
