import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import {
    buildStatusQueryMatchKey,
    contextDataQueryKey,
    favoritesQueryKey,
    libraryQueryMatchKey,
    useJobStatusQuery
} from "../queries";
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
 * the library / search / build-status queries), refetch the snapshot queries a
 * mutation may have touched, and re-run the route loaders. Invalidating the
 * snapshot queries also rolls an optimistic update back to server truth when the
 * mutation failed — the query keys are unchanged there, so the version bump
 * alone wouldn't refetch them. A delete or hide can cascade into favorites too.
 */
export function useRefreshLibrary(): () => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: contextDataQueryKey() });
        await queryClient.invalidateQueries({
            queryKey: libraryQueryMatchKey()
        });
        await queryClient.invalidateQueries({
            queryKey: buildStatusQueryMatchKey()
        });
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

/**
 * Polls whether a load job is running and refreshes the library once it
 * finishes. Mount once (in an editor-gated spot) so the refresh fires from a
 * single place; read-only consumers should use `useJobStatusQuery` directly.
 */
export function useJobStatus(): boolean {
    const refreshLibrary = useRefreshLibrary();
    const running = useJobStatusQuery().data?.running ?? false;
    const wasRunning = useRef(running);
    useEffect(() => {
        if (wasRunning.current && !running) {
            void refreshLibrary();
        }
        wasRunning.current = running;
    }, [running, refreshLibrary]);
    return running;
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
