import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import { contextDataQueryKey, favoritesQueryKey } from "../queries";
import { useLibraryId } from "./library";
import { type ContextData, type LibraryId } from "../../shared/types";
import { getQueryUpdater } from "../common/utils";

/** Refetches the current user's favorites, which aren't version-keyed. */
function refetchFavorites(libraryId: LibraryId): Promise<void> {
    return queryClient.invalidateQueries({
        queryKey: favoritesQueryKey(libraryId)
    });
}

/**
 * Refreshes the whole library view: refetch the context (its cacheVersion keys
 * the library / search / build-status queries), refetch favorites (a delete or
 * hide can cascade into them), and re-run the route loaders. Every
 * library-mutating endpoint bumps the version, so the version-keyed queries
 * refetch on their own once the loaders re-run.
 */
export function useRefreshLibrary(): () => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: contextDataQueryKey() });
        await refetchFavorites(libraryId);
        await router.invalidate();
    }, [router, libraryId]);
}

/** Refreshes just the current user's favorites. */
export function useRefreshFavorites(): () => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(async () => {
        await refetchFavorites(libraryId);
        await router.invalidate();
    }, [router, libraryId]);
}

/** Optimistically patches the cached context data and re-runs the loaders. */
export function useUpdateContextData(): (
    recipe: (data: ContextData) => void
) => void {
    const router = useRouter();
    return useCallback(
        (recipe: (data: ContextData) => void) => {
            queryClient.setQueryData(
                contextDataQueryKey(),
                getQueryUpdater(recipe)
            );
            void router.invalidate();
        },
        [router]
    );
}
