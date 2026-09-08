import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import {
    getFavoriteForInsertable,
    type Favorite,
    type FavoritesData
} from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getAccessDataQuery, useIsSignedIn } from "../auth/access-level";
import { useLibraryId } from "../library/library-path";
import { queryClient } from "../../lib/query-client";
import { favoritesQueryKey } from "../../lib/query-keys";

export function getFavoritesQuery(libraryId: LibraryId) {
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
 * Stays disabled until access says signed in, since the endpoint 401s otherwise.
 * That leaves it pending forever while signed out, so a caller that renders
 * either way has to check sign-in itself rather than wait on this.
 */
export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    const isSignedIn = useIsSignedIn();
    return useQuery({
        ...getFavoritesQuery(libraryId),
        enabled: isSignedIn === true
    });
}

/** The caller's favorite for an insertable, if signed in and it is one. */
export function useFavorite(insertableId: string): Favorite | undefined {
    const favorites = useFavoritesQuery().data?.favorites;
    return favorites
        ? getFavoriteForInsertable(favorites, insertableId)
        : undefined;
}
