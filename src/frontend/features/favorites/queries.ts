import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { type FavoritesData } from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getAccessDataQuery } from "../auth/access-level";
import { useLibraryId } from "../library/library-path";
import { queryClient } from "../../lib/query-client";
import { favoritesQueryKey } from "../../lib/query-keys";

const EMPTY_FAVORITES: FavoritesData = { favorites: {}, favoriteOrder: [] };

/**
 * Resolved here rather than gated by `enabled`: a disabled query is pending
 * forever, so a signed-in caller would see no favorites until access lands.
 */
export function getFavoritesQuery(libraryId: LibraryId) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: async () => {
            const { signedIn } =
                await queryClient.ensureQueryData(getAccessDataQuery());
            // Not signed in: no favorites, and the endpoint 401s.
            if (!signedIn) {
                return EMPTY_FAVORITES;
            }
            return apiGet("/favorites/library/" + libraryId);
        }
    });
}

export function useFavoritesQuery() {
    return useQuery(getFavoritesQuery(useLibraryId()));
}
