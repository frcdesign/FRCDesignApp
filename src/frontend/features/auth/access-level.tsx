import { PropsWithChildren, useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
    AccessLevel,
    type AccessData,
    isWithinAccessLevel,
    hasEditorAccess
} from "@backend/features/auth/access-level";
import { accessDataQueryKey } from "../../lib/query-keys";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import type { LibraryId } from "@backend/features/library/library-id";
import { apiGet } from "../../lib/api-client";
import { useUiState } from "../../lib/ui-state";

/** The level the app is viewed as by default; the dev override grants it too. */
const DEFAULT_ACCESS_LEVEL =
    (import.meta.env.VITE_ACCESS_LEVEL_OVERRIDE as AccessLevel | undefined) ??
    AccessLevel.USER;

/** Granted as well as viewed, or the clamp would drop a dev override while pending. */
const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: DEFAULT_ACCESS_LEVEL,
    signedIn: false
};

/** Access to one library: its admin team is what grants more than a user's. */
export function getAccessDataQuery(libraryId: LibraryId) {
    return queryOptions<AccessData>({
        queryKey: accessDataQueryKey(libraryId),
        queryFn: () => apiGet("/access-data" + toLibraryPath(libraryId))
    });
}

/** Server access plus the level the app is currently viewed as. */
interface ResolvedAccessData extends AccessData {
    currentAccessLevel: AccessLevel;
    /** While set, the rest are placeholders, so signed-out UI must wait or it flashes. */
    isPending: boolean;
}

/** The viewed level is a local choice, so it survives refetches. */
export function useAccessData(): ResolvedAccessData {
    const libraryId = useLibraryId();
    const { data, isPending } = useQuery(getAccessDataQuery(libraryId));
    const serverData = data ?? DEFAULT_ACCESS_DATA;
    const chosenLevel = useUiState((state) => state.accessLevel);
    return useMemo(() => {
        const desired = chosenLevel ?? DEFAULT_ACCESS_LEVEL;
        let currentAccessLevel = desired;
        if (!isWithinAccessLevel(desired, serverData.maxAccessLevel)) {
            // A stored choice can outlive the access that allowed it; clamp to max.
            currentAccessLevel = serverData.maxAccessLevel;
        }
        return { ...serverData, currentAccessLevel, isPending };
    }, [serverData, chosenLevel, isPending]);
}

/** Reads signed out while pending; see `isPending`. */
export function useIsSignedIn(): boolean {
    const accessData = useAccessData();
    return accessData.signedIn;
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

export function useShowHidden(): boolean {
    const accessData = useAccessData();
    return hasEditorAccess(accessData.currentAccessLevel);
}
