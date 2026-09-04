import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { useIsJobRunning } from "../features/library/queries";
import {
    accessDataQueryKey,
    favoritesQueryKey,
    libraryQueryKey
} from "./query-keys";
import { useLibraryId } from "../features/library/library-path";

/**
 * Refreshes the current library and the caller's access. Invalidating the
 * snapshot queries also rolls a failed optimistic update back to server truth.
 */
export function useRefreshLibrary(): () => Promise<void> {
    const router = useRouter();
    const libraryId = useLibraryId();
    return useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: libraryQueryKey(libraryId)
            }),
            queryClient.invalidateQueries({ queryKey: accessDataQueryKey() })
        ]);
        await router.invalidate();
    }, [router, libraryId]);
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

/** Polls whether a load job is running and refreshes the library once it finishes. */
export function useJobStatus(): boolean {
    const refreshLibrary = useRefreshLibrary();
    const running = useIsJobRunning();
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
