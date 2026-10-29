import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "./query-client";
import {
    accessDataQueryKey,
    favoritesQueryKey,
    isVersionedLibraryQuery,
    libraryQueryKey
} from "./query-keys";
import { useLibraryId } from "./library";

interface RefreshLibraryOptions {
    /** For a failed mutation: refetches versioned queries to drop optimistic patches. */
    discardPatches?: boolean;
}

/**
 * Leaves versioned queries alone: their urls are immutable, so refetching the
 * old version restores its old state. The bump moves to a new key, which fetches.
 */
export function useRefreshLibrary(): (
    options?: RefreshLibraryOptions
) => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(
        async ({ discardPatches = false }: RefreshLibraryOptions = {}) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: libraryQueryKey(libraryId),
                    predicate: (query) =>
                        discardPatches ||
                        !isVersionedLibraryQuery(query.queryKey)
                }),
                queryClient.invalidateQueries({
                    queryKey: accessDataQueryKey()
                })
            ]);
            await router.invalidate();
        },
        [router, libraryId]
    );
}

/** Refreshes just the current user's favorites, which aren't version-keyed. */
export function useRefreshFavorites(): () => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: favoritesQueryKey(libraryId)
        });
        await router.invalidate();
    }, [router, libraryId]);
}
