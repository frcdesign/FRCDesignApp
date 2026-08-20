import { queryOptions, useQuery } from "@tanstack/react-query";
import MiniSearch from "minisearch";
import { apiGetText } from "./api-utils/api";
import { LibraryId } from "../shared/library-id";
import { SEARCH_OPTIONS } from "../shared/search";
import { toLibraryPath, useLibraryId } from "./api-utils/library";
import { useCacheVersion } from "./library-queries";
import { searchDbQueryKey } from "./query-keys";

export function getSearchDbQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<MiniSearch | null>({
        queryKey: searchDbQueryKey(libraryId, cacheVersion),
        queryFn: async () => {
            const searchDb = await apiGetText(
                "/search-db" + toLibraryPath(libraryId),
                {
                    cacheId: cacheVersion
                }
            );
            if (!searchDb) {
                return null;
            }
            return MiniSearch.loadJSON(searchDb, SEARCH_OPTIONS);
        },
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useSearchDbQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getSearchDbQuery(libraryId, cacheVersion));
}
