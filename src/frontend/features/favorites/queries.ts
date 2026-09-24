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
import { showErrorToast, showSuccessToast } from "../../lib/notifications";
import { getQueryUpdater } from "../../lib/query-cache";
import { useRefreshFavorites } from "../../lib/refresh";

function getFavoritesQuery(libraryId: LibraryId) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId)
    });
}

/** Signed out has none, so this doesn't block the loader. */
export async function prefetchFavorites(libraryId: LibraryId): Promise<void> {
    const { signedIn } = await queryClient.ensureQueryData(
        getAccessDataQuery(libraryId)
    );
    if (signedIn) {
        await queryClient.prefetchQuery(getFavoritesQuery(libraryId));
    }
}

/** Stays pending while signed out, so callers check sign-in rather than wait. */
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
    const favoritesQuery = useFavoritesQuery();
    const favorites = favoritesQuery.data?.favorites;
    return favorites
        ? getFavoriteForInsertable(favorites, insertableId)
        : undefined;
}

/** What a favorite is saved to open with, and the thumbnail that names. */
interface DefaultConfiguration {
    selection: Selection;
    /** So the cached row names the right thumbnail before the refetch. */
    configurationKey: ConfigurationKey;
}

/** Saves what the favorite opens with. */
export function useSetDefaultConfigurationMutation(favoriteId: string) {
    const libraryId = useLibraryId();
    const refreshFavorites = useRefreshFavorites();
    return useMutation({
        mutationKey: ["set-default-selection"],
        mutationFn: async ({ selection }: DefaultConfiguration) =>
            apiPost("/default-selection" + toFavoritePath(favoriteId), {
                body: { selection }
            }),
        onMutate: async ({ selection, configurationKey }) => {
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
            // No router.invalidate(): the loader's prefetch would race this and undo it.
        },
        onError: () => {
            showErrorToast(
                "Unexpectedly failed to update default configuration."
            );
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated default configuration.");
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
            // No router.invalidate(): the loader's prefetch would race this and undo it.
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: refreshFavorites
    });
}
