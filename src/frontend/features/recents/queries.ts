import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import type { RecentsData } from "@backend/features/recents/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getAccessDataQuery, useIsSignedIn } from "../auth/access-level";
import { useLibraryId } from "../../lib/library";
import { queryClient } from "../../lib/query-client";
import { recentsQueryKey } from "../../lib/query-keys";
import { toLibraryPath } from "../../lib/api-paths";

function getRecentsQuery(libraryId: LibraryId) {
    return queryOptions<RecentsData>({
        queryKey: recentsQueryKey(libraryId),
        queryFn: () => apiGet("/recents" + toLibraryPath(libraryId))
    });
}

/** Signed out has none, so this doesn't block the loader. */
export async function prefetchRecents(libraryId: LibraryId): Promise<void> {
    const { signedIn } = await queryClient.ensureQueryData(
        getAccessDataQuery(libraryId)
    );
    if (signedIn) {
        await queryClient.prefetchQuery(getRecentsQuery(libraryId));
    }
}

/** Stays pending while signed out, so callers check sign-in rather than wait. */
export function useRecentsQuery() {
    const libraryId = useLibraryId();
    const isSignedIn = useIsSignedIn();
    return useQuery({
        ...getRecentsQuery(libraryId),
        enabled: isSignedIn
    });
}

/** The server records every insert, so the list only needs fetching again. */
export function invalidateRecents(libraryId: LibraryId): Promise<void> {
    return queryClient.invalidateQueries({
        queryKey: recentsQueryKey(libraryId)
    });
}
