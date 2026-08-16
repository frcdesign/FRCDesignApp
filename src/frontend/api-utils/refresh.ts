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
 * Refreshes the library view (and favorites). Invalidating the snapshot queries
 * also rolls a failed optimistic update back to server truth on the refetch.
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

/** Polls whether a load job is running and refreshes the library once it finishes. */
export function useJobStatus(): boolean {
    const refreshLibrary = useRefreshLibrary();
    const running = useJobStatusQuery().data?.running ?? false;
    // A ref, not state: tracking the previous value to detect the finished
    // transition shouldn't trigger a render (and set-state-in-effect is banned).
    const wasRunning = useRef(running);
    useEffect(() => {
        if (wasRunning.current && !running) {
            void refreshLibrary();
        }
        wasRunning.current = running;
    }, [running, refreshLibrary]);
    return running;
}

type ContextDataUpdate = (data: ContextData) => void;

interface UpdateContextDataOptions {
    /**
     * Re-run the loaders. Costs a round of pending matches — which unmounts the
     * app shell — so pass false when nothing rendered from loader data changed.
     * @default true
     */
    reload?: boolean;
}

/** Optimistically patches the cached context data and re-runs the loaders. */
export function useUpdateContextData(): (
    update: ContextDataUpdate,
    options?: UpdateContextDataOptions
) => void {
    const router = useRouter();
    return useCallback(
        (update: ContextDataUpdate, options?: UpdateContextDataOptions) => {
            queryClient.setQueryData(
                contextDataQueryKey(),
                getQueryUpdater(update)
            );
            if (options?.reload ?? true) {
                void router.invalidate();
            }
        },
        [router]
    );
}
