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
 * Resolved in the query rather than gating it with `enabled`: a disabled query
 * reports pending forever, and the access-data placeholder says signed out, so
 * a signed-in caller would be shown no favorites until both land.
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
