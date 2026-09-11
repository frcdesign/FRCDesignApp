import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { produce } from "immer";
import { apiGet, apiPost } from "../../lib/api-client";
import {
    getFavoriteForInsertable,
    type Favorite,
    type FavoritesData
} from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getAccessDataQuery, useIsSignedIn } from "../auth/access-level";
import { useLibraryId } from "../../lib/library";
import { queryClient } from "../../lib/query-client";
import { favoritesQueryKey } from "../../lib/query-keys";
import {
    type ConfigurationKey,
    type Selection
} from "@backend/features/configurations/contract";
import { toFavoritePath, toLibraryPath } from "../../lib/api-paths";
import { getAppErrorHandler } from "../../lib/errors";
import {
    showErrorToast,
    showSuccessToast
} from "../../lib/notifications";
import { getQueryUpdater } from "../../lib/query-cache";
import { useRefreshFavorites } from "../../lib/refresh";

function getFavoritesQuery(libraryId: LibraryId) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId)
    });
}

/** Awaits access rather than blocking the loader on it: signed out has none. */
export async function prefetchFavorites(libraryId: LibraryId): Promise<void> {
    const { signedIn } =
        await queryClient.ensureQueryData(getAccessDataQuery());
    if (signedIn) {
        await queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
}

/**
 * Disabled until access says signed in, the endpoint 401ing otherwise — so it
 * stays pending while signed out, and callers check sign-in rather than wait.
 */
export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    const isSignedIn = useIsSignedIn();
    return useQuery({
        ...getFavoritesQuery(libraryId),
        enabled: isSignedIn
    });
}

/** The caller's favorite for an insertable, if signed in and it is one. */
export function useFavorite(insertableId: string): Favorite | undefined {
    const favorites = useFavoritesQuery().data?.favorites;
    return favorites
        ? getFavoriteForInsertable(favorites, insertableId)
        : undefined;
}

/**
 * Saves what the favorite opens with. Takes its key too, so the
 * cached row names the right thumbnail before the refetch answers.
 */
export function useSetDefaultConfigurationMutation(
    favoriteId: string,
    selection: Selection | undefined,
    configurationKey: ConfigurationKey | undefined
) {
    const libraryId = useLibraryId();
    const refreshFavorites = useRefreshFavorites();
    return useMutation({
        mutationKey: ["set-default-selection"],
        mutationFn: async () => {
            // The whole selection, not its key: the key names only what the
            // selection overrides, and the favorite opens on all of it.
            return apiPost("/default-selection" + toFavoritePath(favoriteId), {
                body: { selection: selection }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(libraryId);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    const fav = data.favorites[favoriteId];
                    if (fav) {
                        fav.defaultSelection = selection;
                        fav.configurationKey = configurationKey;
                    }
                    return data;
                })
            );
            // No router.invalidate(): the route loader prefetches favorites,
            // and that fetch would race the mutation and undo this update.
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update default selection.");
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated default selection.");
        },
        onSettled: refreshFavorites
    });
}

/** Reorders the caller's favorites, shown before the server confirms. */
export function useSetFavoriteOrderMutation() {
    const libraryId = useLibraryId();
    const refreshFavorites = useRefreshFavorites();

    const queryKey = favoritesQueryKey(libraryId);

    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost("/favorite-order" + toLibraryPath(libraryId), {
                body: { favoriteOrder }
            });
        },
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                produce((data?: { favoriteOrder: string[] }) => {
                    if (!data) return undefined;
                    data.favoriteOrder = newOrder;
                    return data;
                })
            );
            // No router.invalidate(): the route loader prefetches favorites,
            // and that fetch would race the mutation and undo this update.
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: refreshFavorites
    });
}
