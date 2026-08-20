import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-utils/api";
import { type FavoritesData } from "../shared/favorites-dto";
import { LibraryId } from "../shared/library-id";
import { useAccessData } from "./api-utils/access-level";
import { useLibraryId } from "./api-utils/library";
import { favoritesQueryKey } from "./query-keys";

const EMPTY_FAVORITES: FavoritesData = { favorites: {}, favoriteOrder: [] };

export function getFavoritesQuery(libraryId: LibraryId, enabled = true) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId),
        enabled,
        // Not signed in: the endpoint 401s, so present no favorites.
        placeholderData: EMPTY_FAVORITES
    });
}

export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    // Favorites require sign-in; don't fetch (or display) them otherwise.
    const signedIn = useAccessData().signedIn;
    return useQuery(getFavoritesQuery(libraryId, signedIn));
}
