import { useMemo } from "react";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import {
    AccessLevel,
    type AccessData,
    isWithinAccessLevel,
    hasEditorAccess
} from "@backend/features/auth/access-level";
import { accessDataQueryKey } from "../../lib/query-keys";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import { LibraryId } from "@backend/features/library/library-id";
import { apiGet } from "../../lib/api-client";
import { useUiState } from "../../lib/ui-state";

/** The level the app is viewed as by default; the dev override grants it too. */
const DEFAULT_ACCESS_LEVEL =
    (import.meta.env.VITE_ACCESS_LEVEL_OVERRIDE as AccessLevel | undefined) ??
    AccessLevel.USER;

/** Granted as well as viewed, or the clamp would drop a dev override while pending. */
const DEFAULT_ACCESS_DATA: AccessData = {
    maxAccessLevel: DEFAULT_ACCESS_LEVEL,
    signedIn: false,
    seenHints: []
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

/** A stored choice can outlive the access that allowed it, so it is clamped to max. */
function resolveAccessData(
    serverData: AccessData,
    chosenLevel: AccessLevel | undefined,
    isPending: boolean
): ResolvedAccessData {
    const desired = chosenLevel ?? DEFAULT_ACCESS_LEVEL;
    const currentAccessLevel = isWithinAccessLevel(
        desired,
        serverData.maxAccessLevel
    )
        ? desired
        : serverData.maxAccessLevel;
    return { ...serverData, currentAccessLevel, isPending };
}

/** The viewed level is a local choice, so it survives refetches. */
export function useAccessData(): ResolvedAccessData {
    const libraryId = useLibraryId();
    const { data, isPending } = useQuery(getAccessDataQuery(libraryId));
    const chosenLevel = useUiState((state) => state.accessLevel);
    return useMemo(
        () =>
            resolveAccessData(
                data ?? DEFAULT_ACCESS_DATA,
                chosenLevel,
                isPending
            ),
        [data, chosenLevel, isPending]
    );
}

const LIBRARY_IDS = Object.values(LibraryId);

/** As `useAccessData`, for every library at once. */
export function useEveryLibraryAccess(): Record<LibraryId, ResolvedAccessData> {
    const chosenLevel = useUiState((state) => state.accessLevel);
    return useQueries({
        queries: LIBRARY_IDS.map(getAccessDataQuery),
        combine: (results) =>
            Object.fromEntries(
                results.map((result, index) => [
                    LIBRARY_IDS[index],
                    resolveAccessData(
                        result.data ?? DEFAULT_ACCESS_DATA,
                        chosenLevel,
                        result.isPending
                    )
                ])
            ) as Record<LibraryId, ResolvedAccessData>
    });
}

/** Reads signed out while pending; see `isPending`. */
export function useIsSignedIn(): boolean {
    const accessData = useAccessData();
    return accessData.signedIn;
}

/**
 * Whether the caller has no Onshape session to work with, and so is offered one.
 * Pending reads as signed in: nothing is offered until the answer arrives, and
 * inside Onshape's panel signed in is the answer.
 */
export function useNeedsSignIn(): boolean {
    const { signedIn, isPending } = useAccessData();
    return !signedIn && !isPending;
}

export function useShowHidden(): boolean {
    const accessData = useAccessData();
    return hasEditorAccess(accessData.currentAccessLevel);
}
