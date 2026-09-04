import { PropsWithChildren, useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
    AccessLevel,
    type AccessData,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { accessDataQueryKey } from "../../lib/query-keys";
import { apiGet } from "../../lib/api-client";
import { useGetUiState } from "../../lib/ui-state";

/** The level the app is viewed as by default; the dev override grants it too. */
const DEFAULT_ACCESS_LEVEL =
    (import.meta.env.VITE_ACCESS_LEVEL_OVERRIDE as AccessLevel | undefined) ??
    AccessLevel.USER;

/**
 * What the app assumes until the server answers. Granted as well as viewed, or
 * the clamp below would drop a dev override while the query is pending.
 */
const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: DEFAULT_ACCESS_LEVEL,
    signedIn: false
};

export function getAccessDataQuery() {
    return queryOptions<AccessData>({
        queryKey: accessDataQueryKey(),
        queryFn: () => apiGet("/access-data")
    });
}

/** Server access plus the level the app is currently viewed as. */
export interface ResolvedAccessData extends AccessData {
    currentAccessLevel: AccessLevel;
    /**
     * While set, the rest are the placeholder — so anything rendered for a
     * *signed-out* caller must wait or it flashes. Positive gates need not.
     */
    isPending: boolean;
}

/**
 * The caller's access. The viewed level is a local choice (the settings menu can
 * drop below the granted max), so it survives the query refetching on navigation.
 */
export function useAccessData(): ResolvedAccessData {
    const { data, isPending } = useQuery(getAccessDataQuery());
    const serverData = data ?? DEFAULT_ACCESS_DATA;
    const chosenLevel = useGetUiState().accessLevel;
    return useMemo(() => {
        const desired = chosenLevel ?? DEFAULT_ACCESS_LEVEL;
        // A stored choice can outlive the access that allowed it; clamp to max.
        const currentAccessLevel = isWithinAccessLevel(
            desired,
            serverData.maxAccessLevel
        )
            ? desired
            : serverData.maxAccessLevel;
        return { ...serverData, currentAccessLevel, isPending };
    }, [serverData, chosenLevel, isPending]);
}

/**
 * Whether the caller is signed in to Onshape, or undefined until access-data
 * lands: the placeholder says signed out, which is not yet an answer.
 */
export function useIsSignedIn(): boolean | undefined {
    const { signedIn, isPending } = useAccessData();
    return isPending ? undefined : signedIn;
}

interface RequireAccessLevelProps extends PropsWithChildren {
    /** @default AccessLevel.EDITOR */
    accessLevel?: AccessLevel;
    /** Check against maxAccessLevel instead of the viewed level. @default false */
    useMaxAccessLevel?: boolean;
}

export function RequireAccessLevel(props: RequireAccessLevelProps) {
    const {
        accessLevel = AccessLevel.EDITOR,
        useMaxAccessLevel = false,
        children
    } = props;
    const accessData = useAccessData();
    const currentAccessLevel = useMaxAccessLevel
        ? accessData.maxAccessLevel
        : accessData.currentAccessLevel;

    // Reads backwards: the level held is the ceiling the requirement fits under.
    return isWithinAccessLevel(accessLevel, currentAccessLevel)
        ? children
        : null;
}

export function RequireSignIn(props: PropsWithChildren) {
    return useIsSignedIn() ? props.children : null;
}
