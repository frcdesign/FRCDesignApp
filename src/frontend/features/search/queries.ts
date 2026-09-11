import { queryOptions, useQuery } from "@tanstack/react-query";
import MiniSearch from "minisearch";
import { apiGetText } from "../../lib/api-client";
import { LibraryId } from "@backend/features/library/library-id";
import {
    SEARCH_OPTIONS,
    type SearchDocument
} from "@backend/lib/search-index";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import { useCacheVersion } from "../library/queries";
import { searchDbQueryKey } from "../../lib/query-keys";

export function getSearchDbQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<MiniSearch<SearchDocument> | null>({
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
            return MiniSearch.loadJSON<SearchDocument>(
                searchDb,
                SEARCH_OPTIONS
            );
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
