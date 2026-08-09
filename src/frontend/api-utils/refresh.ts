import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import { contextDataQueryKey, favoritesQueryKey } from "../queries";
import { useLibraryId } from "./library";
import { type ContextData } from "../../shared/types";
import { getQueryUpdater } from "../common/utils";

/**
 * Refreshes the whole library view: refetch the context (its cacheVersion keys
 * the library / search / build-status queries) and re-run the route loaders.
 * Every library-mutating endpoint bumps the version, so those version-keyed
 * queries refetch on their own — no per-query invalidation needed.
 */
export function useRefreshLibrary(): () => Promise<void> {
    const router = useRouter();
    return useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: contextDataQueryKey() });
        await router.invalidate();
    }, [router]);
}

/** Refreshes the current user's favorites, which aren't version-keyed. */
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
