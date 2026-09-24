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
    /**
     * Refetch the version-keyed queries too, dropping whatever an optimistic
     * patch left on them. For a mutation that failed: it bumped nothing, so the
     * version on screen is still the one the server can answer for.
     */
    discardPatches?: boolean;
}

/**
 * Refreshes the current library and the caller's access.
 *
 * The version-keyed queries are left alone, because a versioned url answers for
 * its own version and keeps answering for it — immutably, out of the browser's
 * cache. Refetching the version a bump is replacing therefore reinstates the
 * state that version had, which is what put an optimistic patch back to its old
 * value for one round trip before the new version landed. Moving the pointer is
 * enough: the new version is a new key, and it fetches.
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
